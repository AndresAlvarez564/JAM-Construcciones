import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

cognito = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

USER_POOL_ID = os.environ['USER_POOL_ID']
USER_POOL_CLIENT_ID = os.environ['USER_POOL_CLIENT_ID']
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']


def handler(event, context):
    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    inmo_id = path_params.get('inmo_id')
    usuario_id = path_params.get('usuario_id')

    print(f"DEBUG method={method} path={path} path_params={path_params}")

    if method == 'POST' and path.endswith('/login'):
        return login(event)

    if method == 'GET' and path.endswith('/me'):
        return me(event)

    # ── Admin: inmobiliarias ──────────────────────────────────
    if not _is_admin(event):
        return response(403, {'message': 'Sin permisos'})

    if method == 'GET' and path.endswith('/inmobiliarias'):
        return listar_inmobiliarias()

    if method == 'POST' and path.endswith('/inmobiliarias'):
        return crear_inmobiliaria(event)

    if method == 'PUT' and inmo_id and path.endswith(f'/{inmo_id}'):
        return actualizar_inmobiliaria(inmo_id, event)

    if method == 'PUT' and inmo_id and path.endswith('/deshabilitar') and not usuario_id:
        return deshabilitar_inmobiliaria(inmo_id)

    if method == 'PUT' and inmo_id and path.endswith('/habilitar') and not usuario_id:
        return habilitar_inmobiliaria(inmo_id)

    # ── Admin: usuarios de inmobiliaria ───────────────────────
    if method == 'GET' and inmo_id and path.endswith('/usuarios'):
        return listar_usuarios_inmobiliaria(inmo_id)

    if method == 'POST' and inmo_id and path.endswith('/usuarios'):
        return crear_usuario_inmobiliaria(inmo_id, event)

    if method == 'PUT' and usuario_id and path.endswith('/deshabilitar'):
        print(f"DEBUG → deshabilitar_usuario usuario_id={usuario_id}")
        return deshabilitar_usuario(usuario_id)

    if method == 'PUT' and usuario_id and path.endswith('/habilitar'):
        print(f"DEBUG → habilitar_usuario usuario_id={usuario_id}")
        return habilitar_usuario(usuario_id)

    return response(404, {'message': 'Not found'})


# ── Auth ──────────────────────────────────────────────────────

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
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        cognito_sub = claims.get('sub')
        if not cognito_sub:
            return response(401, {'message': 'No autorizado'})

        table = dynamodb.Table(USUARIOS_TABLE)
        item = table.get_item(Key={'pk': f'USUARIO#{cognito_sub}', 'sk': 'METADATA'}).get('Item')
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

        if item.get('rol') == 'inmobiliaria' and item.get('inmobiliaria_id'):
            inmo = table.get_item(
                Key={'pk': item['inmobiliaria_id'], 'sk': 'METADATA'}
            ).get('Item', {})
            perfil['proyectos'] = inmo.get('proyectos', [])
            perfil['inmobiliaria_nombre'] = inmo.get('nombre')

        return response(200, perfil)
    except Exception as e:
        import traceback
        print(f"ERROR en me(): {traceback.format_exc()}")
        return response(500, {'message': 'Error interno'})


# ── Inmobiliarias ─────────────────────────────────────────────

def listar_inmobiliarias():
    table = dynamodb.Table(USUARIOS_TABLE)
    result = table.query(
        IndexName='gsi-tipo',
        KeyConditionExpression=Key('tipo').eq('INMOBILIARIA')
    )
    return response(200, result.get('Items', []))


def crear_inmobiliaria(event):
    body = json.loads(event.get('body') or '{}')
    nombre = body.get('nombre')
    if not nombre:
        return response(400, {'message': 'nombre requerido'})

    inmo_id = f'INMOBILIARIA#{str(uuid.uuid4())[:8].upper()}'
    now = _now()
    table = dynamodb.Table(USUARIOS_TABLE)
    item = {
        'pk': inmo_id,
        'sk': 'METADATA',
        'tipo': 'INMOBILIARIA',
        'nombre': nombre,
        'correos': body.get('correos', []),
        'proyectos': body.get('proyectos', []),
        'activo': True,
        'creado_en': now,
    }
    table.put_item(Item=item)
    return response(201, item)


def actualizar_inmobiliaria(inmo_id, event):
    body = json.loads(event.get('body') or '{}')
    table = dynamodb.Table(USUARIOS_TABLE)
    updates, values, names = [], {}, {}

    if 'nombre' in body:
        updates.append('#nombre = :nombre')
        values[':nombre'] = body['nombre']
        names['#nombre'] = 'nombre'
    if 'correos' in body:
        updates.append('correos = :correos')
        values[':correos'] = body['correos']
    if 'proyectos' in body:
        updates.append('proyectos = :proyectos')
        values[':proyectos'] = body['proyectos']

    if not updates:
        return response(400, {'message': 'Nada que actualizar'})

    values[':ts'] = _now()
    updates.append('actualizado_en = :ts')

    try:
        table.update_item(
            Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
            UpdateExpression='SET ' + ', '.join(updates),
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues=values,
            **({"ExpressionAttributeNames": names} if names else {})
        )
        return response(200, {'message': 'Inmobiliaria actualizada'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return response(404, {'message': 'Inmobiliaria no encontrada'})
        raise


def deshabilitar_inmobiliaria(inmo_id):
    return _set_activo_inmobiliaria(inmo_id, False)


def habilitar_inmobiliaria(inmo_id):
    return _set_activo_inmobiliaria(inmo_id, True)


def _set_activo_inmobiliaria(inmo_id, activo):
    table = dynamodb.Table(USUARIOS_TABLE)
    try:
        table.update_item(
            Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :activo',
            ConditionExpression='attribute_exists(pk)',
            ExpressionAttributeValues={':activo': activo}
        )
        # También deshabilitar/habilitar todos sus usuarios en Cognito
        result = table.query(
            IndexName='gsi-por-inmobiliaria',
            KeyConditionExpression=Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id}')
        )
        for u in result.get('Items', []):
            cognito_username = u.get('cognito_username')
            if cognito_username:
                if activo:
                    cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=cognito_username)
                else:
                    cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=cognito_username)
        return response(200, {'message': 'OK'})
    except ClientError as e:
        if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
            return response(404, {'message': 'Inmobiliaria no encontrada'})
        raise


# ── Usuarios de inmobiliaria ──────────────────────────────────

def listar_usuarios_inmobiliaria(inmo_id):
    table = dynamodb.Table(USUARIOS_TABLE)
    result = table.query(
        IndexName='gsi-por-inmobiliaria',
        KeyConditionExpression=Key('inmobiliaria_id').eq(f'INMOBILIARIA#{inmo_id}')
    )
    return response(200, result.get('Items', []))


def crear_usuario_inmobiliaria(inmo_id, event):
    body = json.loads(event.get('body') or '{}')
    username = body.get('username')
    password = body.get('password')
    nombre = body.get('nombre', username)

    if not username or not password:
        return response(400, {'message': 'username y password requeridos'})

    try:
        # Crear usuario en Cognito
        cog_result = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=username,
            TemporaryPassword=password,
            MessageAction='SUPPRESS',
        )
        cognito_sub = cog_result['User']['Attributes']
        sub = next((a['Value'] for a in cognito_sub if a['Name'] == 'sub'), None)

        # Forzar contraseña permanente
        cognito.admin_set_user_password(
            UserPoolId=USER_POOL_ID,
            Username=username,
            Password=password,
            Permanent=True,
        )

        # Asignar al grupo inmobiliaria
        cognito.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=username,
            GroupName='inmobiliaria',
        )

        # Guardar en DynamoDB
        table = dynamodb.Table(USUARIOS_TABLE)
        item = {
            'pk': f'USUARIO#{sub}',
            'sk': 'METADATA',
            'inmobiliaria_id': f'INMOBILIARIA#{inmo_id}',
            'cognito_username': username,
            'nombre': nombre,
            'rol': 'inmobiliaria',
            'activo': True,
            'creado_en': _now(),
        }
        table.put_item(Item=item)
        return response(201, {'message': 'Usuario creado', 'sub': sub, 'username': username})

    except ClientError as e:
        code = e.response['Error']['Code']
        if code == 'UsernameExistsException':
            return response(409, {'message': 'El nombre de usuario ya existe'})
        return response(500, {'message': f'Error al crear usuario: {code}'})


def deshabilitar_usuario(usuario_id):
    return _set_activo_usuario(usuario_id, False)


def habilitar_usuario(usuario_id):
    return _set_activo_usuario(usuario_id, True)


def _set_activo_usuario(usuario_id, activo):
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'}).get('Item')
    if not item:
        return response(404, {'message': 'Usuario no encontrado'})

    cognito_username = item.get('cognito_username')
    errors = []

    # 1. Actualizar Cognito
    if cognito_username:
        try:
            if activo:
                cognito.admin_enable_user(UserPoolId=USER_POOL_ID, Username=cognito_username)
            else:
                cognito.admin_disable_user(UserPoolId=USER_POOL_ID, Username=cognito_username)
        except ClientError as e:
            errors.append(f'Cognito: {e.response["Error"]["Code"]}')

    # 2. Actualizar DynamoDB siempre
    try:
        table.update_item(
            Key={'pk': f'USUARIO#{usuario_id}', 'sk': 'METADATA'},
            UpdateExpression='SET activo = :activo',
            ExpressionAttributeValues={':activo': activo}
        )
    except ClientError as e:
        errors.append(f'DynamoDB: {e.response["Error"]["Code"]}')

    if errors:
        return response(500, {'message': f'Errores parciales: {", ".join(errors)}'})

    return response(200, {'message': 'OK', 'activo': activo})


# ── Helpers ───────────────────────────────────────────────────

def _is_admin(event):
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub')
    if not sub:
        return False
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item')
    return item and item.get('rol') == 'admin'


def _build_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body, ensure_ascii=False),
    }


def response(status_code, body):
    return _build_response(status_code, body)


def _now():
    return datetime.now(timezone.utc).isoformat()
