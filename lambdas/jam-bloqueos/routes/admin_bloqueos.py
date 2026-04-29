import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, bad_request, not_found, conflict
from utils.auth import get_claims
from utils import scheduler as sched
from utils.clientes import desvincular_unidad

dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
historial = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
usuarios = dynamodb.Table(os.environ['USUARIOS_TABLE'])
sqs = boto3.client('sqs')
SQS_URL = os.environ.get('SQS_URL', '')


def _get_nombre_usuario(sub: str) -> str:
    try:
        item = usuarios.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item', {})
        return item.get('nombre') or item.get('cognito_username') or sub
    except Exception:
        return sub


def _get_unidad_bloqueada(proyecto_id, unidad_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item or item.get('estado') != 'bloqueada':
        return None
    return item


def _registrar_liberacion(unidad_id, proyecto_id, inmobiliaria_id, motivo, liberado_por, fecha_bloqueo):
    ts = datetime.now(timezone.utc).isoformat()
    # Actualizar el registro de historial existente
    try:
        historial.update_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{fecha_bloqueo}'},
            UpdateExpression='SET motivo_liberacion = :m, liberado_por = :lp, fecha_liberacion = :fl',
            ExpressionAttributeValues={
                ':m': motivo,
                ':lp': liberado_por,
                ':fl': ts,
            },
        )
    except ClientError:
        pass  # Si no existe el registro exacto, no es crítico


def liberar(proyecto_id, unidad_id, event):
    if not proyecto_id:
        return bad_request('proyecto_id requerido (query param)')

    unidad = _get_unidad_bloqueada(proyecto_id, unidad_id)
    if not unidad:
        return not_found('Unidad no encontrada o no está bloqueada')

    claims = get_claims(event)
    admin_id = claims.get('sub', 'admin')
    admin_nombre = _get_nombre_usuario(admin_id)
    inmobiliaria_id = unidad.get('bloqueado_por')
    fecha_bloqueo = unidad.get('fecha_bloqueo', '')

    # Liberar en inventario
    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion, cliente_cedula SET estado = :d',
        ExpressionAttributeValues={':d': 'disponible'},
    )

    # Cancelar schedules pendientes
    sched.eliminar_schedules(unidad_id)

    # Historial
    _registrar_liberacion(unidad_id, proyecto_id, inmobiliaria_id, 'manual', admin_nombre, fecha_bloqueo)

    # Desvincular unidad del cliente si había uno asociado
    cliente_cedula = unidad.get('cliente_cedula', '')
    if cliente_cedula and inmobiliaria_id:
        desvincular_unidad(unidad_id, cliente_cedula, inmobiliaria_id, proyecto_id)

    # Notificar
    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'liberacion_manual',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmobiliaria_id,
                'liberado_por': admin_id,
            }),
        )

    return ok({'message': 'Bloqueo liberado', 'unidad_id': unidad_id})


def extender(proyecto_id, unidad_id, event):
    if not proyecto_id:
        return bad_request('proyecto_id requerido (query param)')

    body = json.loads(event.get('body') or '{}')
    horas_restantes = body.get('horas_restantes')  # Tiempo restante total que quiere
    justificacion = body.get('justificacion', '')

    if horas_restantes is None:
        return bad_request('horas_restantes es requerido')
    
    if not justificacion:
        return bad_request('justificacion es requerida')

    if horas_restantes < 0.02:  # Mínimo ~1 minuto
        return bad_request('El tiempo restante debe ser al menos 1 minuto (0.02 horas)')

    unidad = _get_unidad_bloqueada(proyecto_id, unidad_id)
    if not unidad:
        return not_found('Unidad no encontrada o no está bloqueada')

    claims = get_claims(event)
    admin_id = claims.get('sub', 'admin')
    admin_nombre = _get_nombre_usuario(admin_id)

    fecha_bloqueo = unidad.get('fecha_bloqueo', '')
    ahora = datetime.now(timezone.utc)
    
    # Calcular nueva fecha de liberación basada en tiempo restante
    nueva_dt_lib = ahora + timedelta(hours=horas_restantes)
    nueva_lib = nueva_dt_lib.isoformat()
    
    # Alerta 5 horas antes, pero si el tiempo restante es menor a 5h, poner alerta en 1 minuto
    if horas_restantes <= 5:
        nueva_alerta_dt = ahora + timedelta(minutes=1)
    else:
        nueva_alerta_dt = nueva_dt_lib - timedelta(hours=5)
    nueva_alerta = nueva_alerta_dt.isoformat()

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='SET fecha_liberacion = :lib',
        ExpressionAttributeValues={':lib': nueva_lib},
    )

    # Reemplazar schedules
    sched.eliminar_schedules(unidad_id)
    sched.crear_schedules(unidad_id, proyecto_id, nueva_lib[:19], nueva_alerta[:19])

    # Registrar modificación en historial
    extension = {
        'horas_restantes': horas_restantes,
        'justificacion': justificacion,
        'modificado_por': admin_nombre,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'nueva_fecha_liberacion': nueva_lib,
    }
    try:
        historial.update_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{fecha_bloqueo}'},
            UpdateExpression='SET extensiones = list_append(if_not_exists(extensiones, :empty), :ext)',
            ExpressionAttributeValues={':ext': [extension], ':empty': []},
        )
    except Exception:
        pass

    return ok({
        'message': 'Tiempo de bloqueo actualizado',
        'unidad_id': unidad_id,
        'nueva_fecha_liberacion': nueva_lib,
        'modificado_por': admin_id,
        'justificacion': justificacion,
        'horas_restantes': horas_restantes,
    })