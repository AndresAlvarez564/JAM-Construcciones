import json
import uuid
import boto3
import os
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils.response import ok, created, bad_request, not_found
from utils.helpers import now

inventario = boto3.resource('dynamodb').Table(os.environ['INVENTARIO_TABLE'])


def listar(event):
    result = inventario.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('PROYECTO'),
        FilterExpression=Attr('activo').eq(True)
    )
    return ok(result.get('Items', []))


def detalle(proyecto_id):
    result = inventario.get_item(
        Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'}
    )
    item = result.get('Item')
    if not item:
        return not_found('Proyecto no encontrado')
    return ok(item)


def crear(event):
    body = json.loads(event.get('body') or '{}')
    nombre = body.get('nombre')
    if not nombre:
        return bad_request('nombre requerido')

    proyecto_id = str(uuid.uuid4())[:8].upper()
    item = {
        'pk': f'PROYECTO#{proyecto_id}',
        'sk': 'METADATA',
        'tipo': 'PROYECTO',
        'proyecto_id': proyecto_id,
        'nombre': nombre,
        'descripcion': body.get('descripcion', ''),
        'activo': True,
        'creado_en': now(),
    }
    inventario.put_item(Item=item)
    return created(item)


def actualizar(proyecto_id, event):
    body = json.loads(event.get('body') or '{}')
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        values[':nombre'] = body['nombre']
        updates.append('#nombre = :nombre')
        names['#nombre'] = 'nombre'
    if 'descripcion' in body:
        values[':desc'] = body['descripcion']
        updates.append('descripcion = :desc')

    if not updates:
        return bad_request('No hay campos para actualizar')

    values[':ts'] = now()
    updates.append('actualizado_en = :ts')

    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {})
        )
        return ok({'message': 'Proyecto actualizado'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Proyecto no encontrado')
        raise


def eliminar(proyecto_id):
    try:
        inventario.update_item(
            Key={'pk': f'PROYECTO#{proyecto_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :false',
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues={':false': False}
        )
        return ok({'message': 'Proyecto desactivado'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return not_found('Proyecto no encontrado')
        raise


