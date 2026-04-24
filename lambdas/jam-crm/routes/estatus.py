import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, created, bad_request, not_found, conflict
from utils.auth import get_sub, get_nombre

dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')
scheduler_client = boto3.client('scheduler')

clientes_table = dynamodb.Table(os.environ['CLIENTES_TABLE'])
procesos_table = dynamodb.Table(os.environ['PROCESOS_TABLE'])
inventario_table = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
SQS_URL = os.environ['SQS_URL']
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')
CRM_LAMBDA_ARN = os.environ.get('CRM_LAMBDA_ARN', '')

DIAS_SEPARACION = 30

TRANSICIONES = {
    'captacion':  ['reserva', 'desvinculado'],
    'reserva':    ['separacion', 'desvinculado'],
    'separacion': ['inicial', 'desvinculado'],
    'inicial':    ['desvinculado'],
}


def _now():
    return datetime.now(timezone.utc).isoformat()


def _schedule_name_separacion(cedula, unidad_id):
    safe_cedula = cedula.replace('/', '-').replace('#', '-').replace(' ', '-')
    safe_unidad = unidad_id.replace('/', '-').replace('#', '-')
    return f"sep-{safe_cedula}-{safe_unidad}"[:64]


def _crear_alerta_separacion(cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre):
    """Crea un EventBridge Scheduler que dispara a los 30 días si no se avanzó a inicial."""
    if not SCHEDULER_ROLE_ARN or not CRM_LAMBDA_ARN:
        return
    fecha_alerta = datetime.now(timezone.utc) + timedelta(days=DIAS_SEPARACION)
    schedule_expr = f"at({fecha_alerta.strftime('%Y-%m-%dT%H:%M:%S')})"
    nombre = _schedule_name_separacion(cedula, unidad_id)
    try:
        scheduler_client.create_schedule(
            Name=nombre,
            ScheduleExpression=schedule_expr,
            ScheduleExpressionTimezone='UTC',
            FlexibleTimeWindow={'Mode': 'OFF'},
            Target={
                'Arn': CRM_LAMBDA_ARN,
                'RoleArn': SCHEDULER_ROLE_ARN,
                'Input': json.dumps({
                    'source': 'scheduler',
                    'tipo': 'alerta_separacion_vencida',
                    'cedula': cedula,
                    'inmobiliaria_id': inmobiliaria_id,
                    'proyecto_id': proyecto_id,
                    'unidad_id': unidad_id,
                    'unidad_nombre': unidad_nombre,
                }),
            },
            ActionAfterCompletion='DELETE',
        )
    except Exception:
        pass  # No crítico si falla la creación del schedule


def _cancelar_alerta_separacion(cedula, unidad_id):
    """Cancela el scheduler de alerta de separación si existe."""
    nombre = _schedule_name_separacion(cedula, unidad_id)
    try:
        scheduler_client.delete_schedule(Name=nombre)
    except Exception:
        pass  # Ya expiró o no existe


# ─── Procesos ────────────────────────────────────────────────────────────────

def crear_proceso(cedula, inmobiliaria_id, proyecto_id, unidad_id, unidad_nombre=''):
    """Crea un proceso de venta para cliente + unidad. Llamado desde jam-captacion."""
    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'

    existing = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if existing and existing.get('estado') not in ('desvinculado',):
        return  # Ya existe un proceso activo para esta unidad

    ahora = _now()
    procesos_table.put_item(Item={
        'pk': pk,
        'sk': sk,
        'cedula': cedula,
        'inmobiliaria_id': inmobiliaria_id,
        'proyecto_id': proyecto_id,
        'unidad_id': unidad_id,
        'unidad_nombre': unidad_nombre,
        'estado': 'captacion',
        'historial': [],
        'fecha_inicio': ahora,
        'actualizado_en': ahora,
    })


def crear_proceso_admin(event, cedula):
    """POST /admin/clientes/{cedula}/procesos — admin crea proceso asignando unidad."""
    body = json.loads(event.get('body') or '{}')
    inmobiliaria_id = body.get('inmobiliaria_id')
    proyecto_id = body.get('proyecto_id')
    unidad_id = body.get('unidad_id')

    if not all([inmobiliaria_id, proyecto_id, unidad_id]):
        return bad_request('inmobiliaria_id, proyecto_id y unidad_id son requeridos')

    cliente = clientes_table.get_item(
        Key={'pk': f'CLIENTE#{cedula}#{inmobiliaria_id}', 'sk': f'PROYECTO#{proyecto_id}'}
    ).get('Item')
    if not cliente:
        return not_found('Cliente no encontrado')

    # Verificar que no existe ya un proceso activo para esta unidad (de cualquier cliente)
    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'
    existing = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if existing and existing.get('estado') not in ('desvinculado',):
        return conflict('Ya existe un proceso activo para este cliente y unidad')

    # Verificar que la unidad no esté en proceso activo de otro cliente
    otros = procesos_table.query(
        IndexName='gsi-proyecto-procesos',
        KeyConditionExpression=Key('proyecto_id').eq(proyecto_id),
        FilterExpression=Attr('unidad_id').eq(unidad_id),
    )
    for proc in otros.get('Items', []):
        if proc.get('estado') not in ('desvinculado',) and proc.get('cedula') != cedula:
            return conflict('Esta unidad ya tiene un proceso de venta activo con otro cliente')

    unidad_nombre = _resolver_nombre_unidad(proyecto_id, unidad_id)
    ahora = _now()
    procesos_table.put_item(Item={
        'pk': pk, 'sk': sk,
        'cedula': cedula,
        'inmobiliaria_id': inmobiliaria_id,
        'proyecto_id': proyecto_id,
        'unidad_id': unidad_id,
        'unidad_nombre': unidad_nombre,
        'estado': 'captacion',
        'historial': [],
        'fecha_inicio': ahora,
        'actualizado_en': ahora,
    })
    return created({'message': 'Proceso creado', 'unidad_id': unidad_id, 'estado': 'captacion'})


def _resolver_nombre_unidad(proyecto_id, unidad_id):
    try:
        item = inventario_table.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        ).get('Item', {})
        id_unidad = item.get('id_unidad') or unidad_id
        torre_id = item.get('torre_id')
        if torre_id:
            torre = inventario_table.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'TORRE#{torre_id}'}
            ).get('Item', {})
            torre_nombre = torre.get('nombre')
            if torre_nombre:
                return f"{torre_nombre} · {id_unidad}"
        return id_unidad
    except Exception:
        return unidad_id


def listar_procesos(event, cedula):
    """GET /admin/clientes/{cedula}/procesos — todos los procesos de un cliente."""
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id')

    if inmobiliaria_id:
        pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
        result = procesos_table.query(KeyConditionExpression=Key('pk').eq(pk))
    else:
        result = procesos_table.query(
            IndexName='gsi-cedula-procesos',
            KeyConditionExpression=Key('cedula').eq(cedula),
        )
    return ok(result.get('Items', []))


def sched_eliminar_bloqueo(unidad_id):
    """Cancela los schedules de EventBridge del bloqueo al confirmar reserva."""
    safe = unidad_id.replace('/', '-').replace('#', '-')
    for suffix in ('alerta', 'liberacion'):
        try:
            scheduler_client.delete_schedule(Name=f"bloqueo-{safe}-{suffix}")
        except Exception:
            pass  # Ya expiró o no existe — no es crítico


def cambiar_estatus(event, cedula, proyecto_id, unidad_id):
    """PUT /admin/clientes/{cedula}/proyecto/{id}/unidad/{uid}/estatus"""
    body = json.loads(event.get('body') or '{}')
    nuevo_estatus = body.get('estatus')
    notificar = body.get('notificar', False)
    inmobiliaria_id = body.get('inmobiliaria_id')

    if not nuevo_estatus:
        return bad_request('estatus es requerido')
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id es requerido')

    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'

    proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if not proceso:
        return not_found('Proceso no encontrado para este cliente y unidad')

    estatus_actual = proceso.get('estado')
    permitidos = TRANSICIONES.get(estatus_actual, [])
    if nuevo_estatus not in permitidos:
        return conflict(
            f"Transición no permitida: {estatus_actual} → {nuevo_estatus}. "
            f"Permitidas: {', '.join(permitidos) or 'ninguna'}"
        )

    # Punto 2: validar que la unidad sigue disponible/bloqueada antes de reservar
    if nuevo_estatus == 'reserva':
        unidad = inventario_table.get_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
        ).get('Item', {})
        estado_unidad = unidad.get('estado')
        if estado_unidad not in ('disponible', 'bloqueada'):
            return conflict(
                f"La unidad no está disponible para reservar (estado actual: {estado_unidad})"
            )

    sub = get_sub(event)
    nombre_admin = get_nombre(event)
    ahora = _now()

    # Agregar entrada al historial embebido en el proceso
    entrada_historial = {
        'estatus_anterior': estatus_actual,
        'estatus_nuevo': nuevo_estatus,
        'ejecutado_por': sub,
        'ejecutado_por_nombre': nombre_admin,
        'notificacion_enviada': notificar,
        'timestamp': ahora,
    }

    procesos_table.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression=(
            'SET estado = :e, actualizado_en = :ts, '
            'historial = list_append(if_not_exists(historial, :empty), :entrada)'
        ),
        ExpressionAttributeValues={
            ':e': nuevo_estatus,
            ':ts': ahora,
            ':empty': [],
            ':entrada': [entrada_historial],
        },
    )

    # Actualizar unidad en inventario si aplica
    if nuevo_estatus == 'reserva':
        sched_eliminar_bloqueo(unidad_id)  # cancela liberación automática del bloqueo
        _actualizar_unidad(proyecto_id, unidad_id, 'no_disponible')
    elif nuevo_estatus == 'separacion':
        # Guardar fecha_separacion y crear alerta a 30 días
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET fecha_separacion = :fs',
            ExpressionAttributeValues={':fs': ahora},
        )
        _crear_alerta_separacion(
            cedula, inmobiliaria_id, proyecto_id, unidad_id,
            proceso.get('unidad_nombre', unidad_id)
        )
    elif nuevo_estatus == 'inicial':
        # Pago confirmado manualmente — cancelar alerta y marcar
        _cancelar_alerta_separacion(cedula, unidad_id)
        procesos_table.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET pago_confirmado = :v',
            ExpressionAttributeValues={':v': True},
        )
        _actualizar_unidad(proyecto_id, unidad_id, 'vendida')
    elif nuevo_estatus == 'desvinculado':
        # Si venía de separacion, cancelar la alerta también
        if estatus_actual == 'separacion':
            _cancelar_alerta_separacion(cedula, unidad_id)
        _actualizar_unidad(proyecto_id, unidad_id, 'disponible')

    # Publicar a SQS para TK-08
    cliente = clientes_table.get_item(
        Key={'pk': f'CLIENTE#{cedula}#{inmobiliaria_id}', 'sk': f'PROYECTO#{proyecto_id}'}
    ).get('Item', {})

    sqs.send_message(
        QueueUrl=SQS_URL,
        MessageBody=json.dumps({
            'tipo': 'cambio_estatus',
            'cedula': cedula,
            'proyecto_id': proyecto_id,
            'inmobiliaria_id': inmobiliaria_id,
            'unidad_id': unidad_id,
            'estatus_anterior': estatus_actual,
            'estatus_nuevo': nuevo_estatus,
            'notificar': notificar,
            'correo': cliente.get('correo'),
            'telefono': cliente.get('telefono'),
            'nombres': cliente.get('nombres'),
            'apellidos': cliente.get('apellidos'),
            'timestamp': ahora,
        }, ensure_ascii=False),
    )

    return ok({'message': f'Estatus actualizado a {nuevo_estatus}', 'estatus': nuevo_estatus})


def ver_historial(event, cedula, proyecto_id, unidad_id):
    """GET /admin/clientes/{cedula}/proyecto/{id}/unidad/{uid}/historial"""
    qs = event.get('queryStringParameters') or {}
    inmobiliaria_id = qs.get('inmobiliaria_id')
    if not inmobiliaria_id:
        return bad_request('inmobiliaria_id requerido como query param')

    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'
    proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
    if not proceso:
        return not_found('Proceso no encontrado')

    historial = list(reversed(proceso.get('historial', [])))
    return ok(historial)


def manejar_alerta_separacion(event):
    """Invocado por EventBridge Scheduler cuando vencen los 30 días de separación sin pago."""
    cedula = event.get('cedula')
    inmobiliaria_id = event.get('inmobiliaria_id')
    proyecto_id = event.get('proyecto_id')
    unidad_id = event.get('unidad_id')
    unidad_nombre = event.get('unidad_nombre', unidad_id)

    if not all([cedula, inmobiliaria_id, proyecto_id, unidad_id]):
        return

    pk = f'PROCESO#{cedula}#{inmobiliaria_id}'
    sk = f'UNIDAD#{unidad_id}'
    proceso = procesos_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item')

    # Solo notificar si sigue en separacion y no se confirmó pago
    if not proceso or proceso.get('estado') != 'separacion' or proceso.get('pago_confirmado'):
        return

    # Marcar alerta en el proceso
    procesos_table.update_item(
        Key={'pk': pk, 'sk': sk},
        UpdateExpression='SET alerta_separacion_vencida = :v',
        ExpressionAttributeValues={':v': True},
    )

    # Enviar notificación al admin por SQS
    sqs.send_message(
        QueueUrl=SQS_URL,
        MessageBody=json.dumps({
            'tipo': 'alerta_separacion_vencida',
            'cedula': cedula,
            'proyecto_id': proyecto_id,
            'inmobiliaria_id': inmobiliaria_id,
            'unidad_id': unidad_id,
            'unidad_nombre': unidad_nombre,
            'timestamp': _now(),
        }, ensure_ascii=False),
    )


def _actualizar_unidad(proyecto_id, unidad_id, nuevo_estado):
    try:
        inventario_table.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            UpdateExpression='SET estado = :e, actualizado_en = :ts',
            ExpressionAttributeValues={
                ':e': nuevo_estado,
                ':ts': datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception:
        pass
