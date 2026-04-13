import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, bad_request, not_found, conflict
from utils.auth import get_claims
from utils import scheduler as sched

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
        UpdateExpression='REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion SET estado = :d',
        ExpressionAttributeValues={':d': 'disponible'},
    )

    # Cancelar schedules pendientes
    sched.eliminar_schedules(unidad_id)

    # Historial
    _registrar_liberacion(unidad_id, proyecto_id, inmobiliaria_id, 'manual', admin_nombre, fecha_bloqueo)

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
    horas = body.get('horas_extra', 24)
    justificacion = body.get('justificacion', '')

    if not justificacion:
        return bad_request('justificacion es requerida')

    unidad = _get_unidad_bloqueada(proyecto_id, unidad_id)
    if not unidad:
        return not_found('Unidad no encontrada o no está bloqueada')

    claims = get_claims(event)
    admin_id = claims.get('sub', 'admin')

    fecha_lib_actual = unidad.get('fecha_liberacion', datetime.now(timezone.utc).isoformat())
    # Parsear y extender
    try:
        dt_lib = datetime.fromisoformat(fecha_lib_actual.replace('Z', '+00:00'))
    except ValueError:
        dt_lib = datetime.now(timezone.utc)

    nueva_lib = (dt_lib + timedelta(hours=horas)).isoformat()
    nueva_alerta = (dt_lib + timedelta(hours=horas) - timedelta(hours=5)).isoformat()

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='SET fecha_liberacion = :lib',
        ExpressionAttributeValues={':lib': nueva_lib},
    )

    # Reemplazar schedules
    sched.eliminar_schedules(unidad_id)
    sched.crear_schedules(unidad_id, proyecto_id, nueva_lib[:19], nueva_alerta[:19])

    return ok({
        'message': 'Bloqueo extendido',
        'unidad_id': unidad_id,
        'nueva_fecha_liberacion': nueva_lib,
        'extendido_por': admin_id,
        'justificacion': justificacion,
    })
