import boto3
import os
from boto3.dynamodb.conditions import Key
from utils.response import ok, bad_request

historial = boto3.resource('dynamodb').Table(os.environ['HISTORIAL_TABLE'])


def listar(event):
    """GET /admin/bloqueos/historial?unidad_id=xxx (opcional)"""
    qs = event.get('queryStringParameters') or {}
    unidad_id = qs.get('unidad_id')

    if unidad_id:
        result = historial.query(
            KeyConditionExpression=Key('pk').eq(f'UNIDAD#{unidad_id}'),
            ScanIndexForward=False,  # más reciente primero
        )
    else:
        result = historial.scan()

    items = result.get('Items', [])

    # Extraer unidad_id del pk para facilitar el front
    for item in items:
        if not item.get('unidad_id') and item.get('pk', '').startswith('UNIDAD#'):
            item['unidad_id'] = item['pk'].replace('UNIDAD#', '')

    # Ordenar por fecha_bloqueo desc si fue scan
    if not unidad_id:
        items.sort(key=lambda x: x.get('fecha_bloqueo', ''), reverse=True)

    return ok(items)
