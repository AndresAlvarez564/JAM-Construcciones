import json
import uuid
from datetime import datetime, timezone
import boto3
import os
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])


def listar(proyecto_id, event, rol):
    if not proyecto_id:
        return bad_request('proyecto_id requerido')

    result = inventario.query(
        KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
    )
    items = result.get('Items', [])

    # Filtros opcionales
    qs = event.get('queryStringParameters') or {}
    if qs.get('estado'):
        items = [i for i in items if i.get('estado') == qs['estado']]
    if qs.get('torre_id'):
        items = [i for i in items if i.get('torre_id') == qs['torre_id']]
    if qs.get('etapa_id'):
        items = [i for i in items if i.get('etapa_id') == qs['etapa_id']]

    return ok(items)


def detalle(proyecto_id, unidad_id, rol):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item:
        return not_found('Unidad no encontrada')

    return ok(item)


def crear(proyecto_id, event):
    body = json.loads(event.get('body') or '{}')
    
    # Validar campos requeridos
    id_unidad = body.get('id_unidad')
    etapa_id = body.get('etapa_id')
    torre_id = body.get('torre_id')
    metraje = body.get('metraje')
    precio = body.get('precio')
    
    if not all([id_unidad, etapa_id, torre_id, metraje, precio]):
        return bad_request('Campos requeridos: id_unidad, etapa_id, torre_id, metraje, precio')
    
    # Validar tipos numéricos
    try:
        metraje = float(metraje)
        precio = float(precio)
    except (ValueError, TypeError):
        return bad_request('metraje y precio deben ser numéricos')
    
    unidad_id = str(uuid.uuid4())[:8].upper()
    now = datetime.now(timezone.utc).isoformat()
    
    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': f'UNIDAD#{unidad_id}',
        'unidad_id': unidad_id,
        'id_unidad': id_unidad,
        'etapa_id': etapa_id,
        'torre_id': torre_id,
        'metraje': metraje,
        'precio': precio,
        'estado': 'disponible',
        'creado_en': now,
        'actualizado_en': now,
    }
    
    inventario.put_item(Item=item)
    return created(item)


def eliminar(proyecto_id, unidad_id):
    try:
        inventario.delete_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            ConditionExpression='attribute_exists(pk)'
        )
        return ok({'message': 'Unidad eliminada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Unidad no encontrada')
        raise


def actualizar(proyecto_id, unidad_id, event):
    body = json.loads(event.get('body') or '{}')
    
    # Campos actualizables
    updates = []
    values = {}
    names = {}
    
    if 'metraje' in body:
        try:
            values[':metraje'] = float(body['metraje'])
            updates.append('metraje = :metraje')
        except (ValueError, TypeError):
            return bad_request('metraje debe ser numérico')
    
    if 'precio' in body:
        try:
            values[':precio'] = float(body['precio'])
            updates.append('precio = :precio')
        except (ValueError, TypeError):
            return bad_request('precio debe ser numérico')
    
    if 'id_unidad' in body:
        values[':id_unidad'] = body['id_unidad']
        updates.append('id_unidad = :id_unidad')
    
    if not updates:
        return bad_request('No hay campos para actualizar')
    
    # Siempre actualizar timestamp
    values[':ts'] = datetime.now(timezone.utc).isoformat()
    updates.append('actualizado_en = :ts')
    
    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {})
        )
        return ok({'message': 'Unidad actualizada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Unidad no encontrada')
        raise
