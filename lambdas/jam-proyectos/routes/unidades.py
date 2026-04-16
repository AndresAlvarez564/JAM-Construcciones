import json
import uuid
import boto3
import os
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found
from utils.helpers import now

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])


def _enrich_bloqueo(item):
    """Agrega tiempo_restante (segundos) si la unidad está bloqueada."""
    if item.get('estado') == 'bloqueada' and item.get('fecha_liberacion'):
        try:
            dt_lib = datetime.fromisoformat(item['fecha_liberacion'].replace('Z', '+00:00'))
            restante = int((dt_lib - datetime.now(timezone.utc)).total_seconds())
            item['tiempo_restante'] = max(restante, 0)
        except (ValueError, TypeError):
            item['tiempo_restante'] = 0
    return item


def listar(proyecto_id, event, rol):
    if not proyecto_id:
        return bad_request('proyecto_id requerido')

    qs = event.get('queryStringParameters') or {}

    # Usar gsi-torre si se filtra por torre_id (evita leer todas las unidades)
    if qs.get('torre_id'):
        result = inventario.query(
            IndexName='gsi-torre',
            KeyConditionExpression=Key('torre_id').eq(qs['torre_id']) & Key('sk').begins_with('UNIDAD#')
        )
        items = [i for i in result.get('Items', []) if i.get('pk') == f'PROYECTO#{proyecto_id}' and i.get('id_unidad')]
        if qs.get('etapa_id'):
            items = [i for i in items if i.get('etapa_id') == qs['etapa_id']]
        if qs.get('estado'):
            items = [i for i in items if i.get('estado') == qs['estado']]
    else:
        result = inventario.query(
            KeyConditionExpression=Key('pk').eq(f'PROYECTO#{proyecto_id}') & Key('sk').begins_with('UNIDAD#')
        )
        items = [i for i in result.get('Items', []) if i.get('id_unidad')]
        if qs.get('estado'):
            items = [i for i in items if i.get('estado') == qs['estado']]
        if qs.get('etapa_id'):
            items = [i for i in items if i.get('etapa_id') == qs['etapa_id']]

    # Filtrar campos sensibles para rol inmobiliaria
    if rol == 'inmobiliaria':
        for item in items:
            item.pop('bloqueado_por', None)
            item.pop('cliente_id', None)

    items = [_enrich_bloqueo(i) for i in items]
    return ok(items)


def detalle(proyecto_id, unidad_id, rol):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
    )
    item = result.get('Item')
    if not item:
        return not_found('Unidad no encontrada')

    if rol == 'inmobiliaria':
        item.pop('bloqueado_por', None)
        item.pop('cliente_id', None)

    return ok(_enrich_bloqueo(item))


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
        metraje = Decimal(str(metraje))
        precio = Decimal(str(precio))
    except (ValueError, TypeError):
        return bad_request('metraje y precio deben ser numéricos')
    
    unidad_id = str(uuid.uuid4())[:8].upper()
    ts = now()
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
        'creado_en': ts,
        'actualizado_en': ts,
    }
    
    inventario.put_item(Item=item)
    return created(item)


def eliminar(proyecto_id, unidad_id):
    try:
        inventario.delete_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'},
            ConditionExpression='attribute_exists(pk) AND estado = :disponible',
            ExpressionAttributeValues={':disponible': 'disponible'}
        )
        return ok({'message': 'Unidad eliminada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            # Puede ser que no existe o que está bloqueada/vendida
            item = inventario.get_item(
                Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': f'UNIDAD#{unidad_id}'}
            ).get('Item')
            if not item:
                return not_found('Unidad no encontrada')
            return bad_request(f'No se puede eliminar: la unidad está en estado "{item.get("estado")}"')
        raise


def actualizar(proyecto_id, unidad_id, event):
    body = json.loads(event.get('body') or '{}')
    
    # Campos actualizables
    updates = []
    values = {}
    names = {}
    
    if 'metraje' in body:
        try:
            values[':metraje'] = Decimal(str(body['metraje']))
            updates.append('metraje = :metraje')
        except (ValueError, TypeError):
            return bad_request('metraje debe ser numérico')
    
    if 'precio' in body:
        try:
            values[':precio'] = Decimal(str(body['precio']))
            updates.append('precio = :precio')
        except (ValueError, TypeError):
            return bad_request('precio debe ser numérico')
    
    if 'id_unidad' in body:
        values[':id_unidad'] = body['id_unidad']
        updates.append('id_unidad = :id_unidad')
    
    if not updates:
        return bad_request('No hay campos para actualizar')
    
    # Siempre actualizar timestamp
    values[':ts'] = now()
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
