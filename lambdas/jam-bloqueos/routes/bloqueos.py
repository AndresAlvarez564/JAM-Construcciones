import json
import boto3
import os
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key, Attr
from utils.response import ok, bad_request, conflict, too_many, not_found
from utils.auth import get_inmobiliaria_id
from utils import scheduler as sched

dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
historial = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
sqs = boto3.client('sqs')
SQS_URL = os.environ.get('SQS_URL', '')

HORAS_BLOQUEO = 48
HORAS_ALERTA = 43
HORAS_REBLOQUEO = 24


def bloquear(event):
    body = json.loads(event.get('body') or '{}')
    proyecto_id = body.get('proyecto_id')
    unidad_id = body.get('unidad_id')
    inmobiliaria_id = get_inmobiliaria_id(event)

    if not all([proyecto_id, unidad_id]):
        return bad_request('proyecto_id y unidad_id son requeridos')

    # Verificar restricción de re-bloqueo (misma inmo, misma unidad, < 24h)
    ts_limite = (datetime.now(timezone.utc) - timedelta(hours=HORAS_REBLOQUEO)).isoformat()
    hist = historial.query(
        KeyConditionExpression=Key('pk').eq(f'UNIDAD#{unidad_id}'),
        FilterExpression=Attr('inmobiliaria_id').eq(inmobiliaria_id) & Attr('fecha_liberacion').gte(ts_limite),
        Limit=1,
    )
    if hist.get('Items'):
        return too_many('No puedes re-bloquear esta unidad antes de 24h desde la última liberación')

    now = datetime.now(timezone.utc)
    ts_bloqueo = now.isoformat()
    ts_liberacion = (now + timedelta(hours=HORAS_BLOQUEO)).isoformat()
    ts_alerta = (now + timedelta(hours=HORAS_ALERTA)).isoformat()

    # Escritura condicional — solo si estado == disponible
    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            UpdateExpression='SET estado = :bloqueada, bloqueado_por = :inmo, fecha_bloqueo = :ts, fecha_liberacion = :lib',
            ConditionExpression='estado = :disponible AND attribute_exists(pk)',
            ExpressionAttributeValues={
                ':bloqueada': 'bloqueada',
                ':disponible': 'disponible',
                ':inmo': inmobiliaria_id,
                ':ts': ts_bloqueo,
                ':lib': ts_liberacion,
            },
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return conflict('La unidad no está disponible o ya fue bloqueada')
        raise

    # Programar liberación y alerta en EventBridge Scheduler
    # El timestamp ISO para EventBridge no lleva offset, debe ser UTC sin 'Z' ni '+00:00'
    ts_lib_eb = ts_liberacion[:19]
    ts_alerta_eb = ts_alerta[:19]
    sched.crear_schedules(unidad_id, proyecto_id, ts_lib_eb, ts_alerta_eb)

    # Registrar en historial
    historial.put_item(Item={
        'pk': f'UNIDAD#{unidad_id}',
        'sk': f'BLOQUEO#{ts_bloqueo}',
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmobiliaria_id,
        'fecha_bloqueo': ts_bloqueo,
        'fecha_liberacion': ts_liberacion,
        'motivo_liberacion': None,
    })

    # Notificar vía SQS
    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'bloqueo_registrado',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmobiliaria_id,
                'fecha_bloqueo': ts_bloqueo,
                'fecha_liberacion': ts_liberacion,
            }),
        )

    return ok({
        'unidad_id': unidad_id,
        'proyecto_id': proyecto_id,
        'inmobiliaria_id': inmobiliaria_id,
        'fecha_bloqueo': ts_bloqueo,
        'fecha_liberacion': ts_liberacion,
    })


def listar_activos(event):
    result = inventario.query(
        IndexName='gsi-estado',
        KeyConditionExpression=Key('estado').eq('bloqueada'),
    )
    items = result.get('Items', [])
    return ok(items)
