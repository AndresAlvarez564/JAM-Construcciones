import json
import os
import boto3
from botocore.exceptions import ClientError

cognito = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

USER_POOL_ID = os.environ['USER_POOL_ID']
USER_POOL_CLIENT_ID = os.environ['USER_POOL_CLIENT_ID']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']


def handler(event, context):
    method = event.get('httpMethod')
    path = event.get('path', '')

    if method == 'POST' and path.endswith('/login'):
        return login(event)
    elif method == 'GET' and path.endswith('/me'):
        return me(event)

    return response(404, {'message': 'Not found'})


def login(event):
    try:
        body = json.loads(event.get('body') or '{}')
        username = body.get('username')
        password = body.get('password')

        if not username or not password:
            return response(400, {'message': 'username y password requeridos'})

        result = cognito.initiate_auth(
            AuthFlow='USER_PASSWORD_AUTH',
            AuthParameters={'USERNAME': username, 'PASSWORD': password},
            ClientId=USER_POOL_CLIENT_ID,
        )

        tokens = result['AuthenticationResult']
        return response(200, {
            'access_token': tokens['AccessToken'],
            'id_token': tokens['IdToken'],
            'refresh_token': tokens['RefreshToken'],
            'expires_in': tokens['ExpiresIn'],
        })

    except ClientError as e:
        code = e.response['Error']['Code']
        if code in ('NotAuthorizedException', 'UserNotFoundException'):
            return response(401, {'message': 'Credenciales inválidas'})
        return response(500, {'message': 'Error de autenticación'})


def me(event):
    try:
        # El sub viene en el contexto del authorizer de Cognito
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        cognito_sub = claims.get('sub')

        if not cognito_sub:
            return response(401, {'message': 'No autorizado'})

        table = dynamodb.Table(USUARIOS_TABLE)
        result = table.get_item(Key={'pk': f'USUARIO#{cognito_sub}', 'sk': 'METADATA'})
        item = result.get('Item')

        if not item:
            return response(404, {'message': 'Usuario no encontrado'})

        if not item.get('activo', True):
            return response(403, {'message': 'Usuario deshabilitado'})

        perfil = {
            'sub': cognito_sub,
            'nombre': item.get('nombre'),
            'rol': item.get('rol'),
            'inmobiliaria_id': item.get('inmobiliaria_id'),
            'activo': item.get('activo'),
        }

        # Si es inmobiliaria, traer proyectos asignados
        if item.get('rol') == 'inmobiliaria' and item.get('inmobiliaria_id'):
            inmo = table.get_item(
                Key={'pk': item['inmobiliaria_id'], 'sk': 'METADATA'}
            ).get('Item', {})
            perfil['proyectos'] = inmo.get('proyectos', [])
            perfil['inmobiliaria_nombre'] = inmo.get('nombre')
        else:
            perfil['proyectos'] = []  # admin ve todo, se filtra en cada módulo

        return response(200, perfil)

    except Exception as e:
        return response(500, {'message': 'Error interno'})


def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body, ensure_ascii=False),
    }
