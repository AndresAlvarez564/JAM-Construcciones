"""Helper para desvincular unidades del cliente al liberar un bloqueo."""
import boto3
import os
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')


def desvincular_unidad(unidad_id: str, cliente_cedula: str, inmobiliaria_id: str, proyecto_id: str):
    """Remueve la unidad de la lista unidades[] del cliente."""
    if not all([unidad_id, cliente_cedula, inmobiliaria_id, proyecto_id]):
        return

    tabla_nombre = os.environ.get('CLIENTES_TABLE')
    if not tabla_nombre:
        return

    clientes = dynamodb.Table(tabla_nombre)
    pk = f'CLIENTE#{cliente_cedula}#{inmobiliaria_id}'
    sk = f'PROYECTO#{proyecto_id}'

    try:
        item = clientes.get_item(Key={'pk': pk, 'sk': sk}).get('Item')
        if not item:
            # Intentar sin prefijo INMOBILIARIA# por si el id viene sin él
            pk_alt = f'CLIENTE#{cliente_cedula}#INMOBILIARIA#{inmobiliaria_id}'
            item = clientes.get_item(Key={'pk': pk_alt, 'sk': sk}).get('Item')
            if item:
                pk = pk_alt
            else:
                return

        unidades = item.get('unidades', [])
        nuevas = [u for u in unidades if u.get('unidad_id') != unidad_id]

        if len(nuevas) == len(unidades):
            return  # No estaba vinculada

        clientes.update_item(
            Key={'pk': pk, 'sk': sk},
            UpdateExpression='SET unidades = :u',
            ExpressionAttributeValues={':u': nuevas},
        )
    except Exception as e:
        print(f'desvincular_unidad error: {e}')  # Log para debug, no crítico
