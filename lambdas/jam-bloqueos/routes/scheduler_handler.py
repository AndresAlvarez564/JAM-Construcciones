"""
Maneja los eventos disparados por EventBridge Scheduler:
  - liberar_automatico: libera la unidad a las 48h
  - alerta_vencimiento: notifica 5h antes del vencimiento
"""
import boto3
import json
import os
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
inventario = dynamodb.Table(os.environ['INVENTARIO_TABLE'])
historial = dynamodb.Table(os.environ['HISTORIAL_TABLE'])
sqs = boto3.client('sqs')
SQS_URL = os.environ.get('SQS_URL', '')


def handle(event):
    accion = event.get('accion')
    unidad_id = event.get('unidad_id')
    proyecto_id = event.get('proyecto_id')

    if accion == 'liberar_automatico':
        return _liberar(unidad_id, proyecto_id)
    elif accion == 'alerta_vencimiento':
        return _alertar(unidad_id, proyecto_id)


def _liberar(unidad_id, proyecto_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item or item.get('estado') != 'bloqueada':
        return  # Ya fue liberada manualmente

    inmobiliaria_id = item.get('bloqueado_por')
    fecha_bloqueo = item.get('fecha_bloqueo', '')
    ts_ahora = datetime.now(timezone.utc).isoformat()

    inventario.update_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
        UpdateExpression='REMOVE bloqueado_por, fecha_bloqueo, fecha_liberacion SET estado = :d',
        ExpressionAttributeValues={':d': 'disponible'},
    )

    # Actualizar historial
    try:
        historial.update_item(
            Key={'pk': f'UNIDAD#{unidad_id}', 'sk': f'BLOQUEO#{fecha_bloqueo}'},
            UpdateExpression='SET motivo_liberacion = :m, fecha_liberacion = :fl',
            ExpressionAttributeValues={':m': 'automatica', ':fl': ts_ahora},
        )
    except Exception:
        pass

    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'liberacion_automatica',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': inmobiliaria_id,
            }),
        )


def _alertar(unidad_id, proyecto_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item or item.get('estado') != 'bloqueada':
        return

    if SQS_URL:
        sqs.send_message(
            QueueUrl=SQS_URL,
            MessageBody=json.dumps({
                'evento': 'alerta_vencimiento',
                'unidad_id': unidad_id,
                'proyecto_id': proyecto_id,
                'inmobiliaria_id': item.get('bloqueado_por'),
                'fecha_liberacion': item.get('fecha_liberacion'),
            }),
        )
