import os
import json
import boto3
from boto3.dynamodb.conditions import Key
from utils.response import not_found, forbidden
from routes import auth, inmobiliarias, usuarios, sistema

dynamodb = boto3.resource('dynamodb')
USUARIOS_TABLE = os.environ['USUARIOS_TABLE']


def handler(event, context):
    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    inmo_id = path_params.get('inmo_id')
    usuario_id = path_params.get('usuario_id')

    # ── Públicos ──────────────────────────────────────────────
    if method == 'POST' and path.endswith('/login'):
        return auth.login(event)

    if method == 'POST' and path.endswith('/confirm-mfa'):
        return auth.confirm_mfa(event)

    if method == 'GET' and path.endswith('/me'):
        return auth.me(event)

    # ── Auth MFA setup (requiere token) ───────────────────────
    if method == 'POST' and path.endswith('/mfa/setup'):
        return auth.mfa_setup(event)

    if method == 'POST' and path.endswith('/mfa/verify'):
        return auth.mfa_verify(event)

    # ── Admin: guard ──────────────────────────────────────────
    if not _is_admin(event):
        return forbidden('Sin permisos')

    # ── Usuarios del sistema ──────────────────────────────────
    sistema_usuario_id = path_params.get('usuario_id') if '/sistema/' in path else None

    if method == 'GET' and '/sistema/usuarios' in path:
        return sistema.listar()

    if method == 'POST' and '/sistema/usuarios' in path and not sistema_usuario_id:
        return sistema.crear(event)

    if method == 'PUT' and sistema_usuario_id and '/sistema/usuarios/' in path and path.endswith(f'/{sistema_usuario_id}'):
        return sistema.actualizar(sistema_usuario_id, event)

    if method == 'PUT' and sistema_usuario_id and '/sistema/usuarios/' in path and path.endswith('/deshabilitar'):
        return sistema.deshabilitar(sistema_usuario_id)

    if method == 'PUT' and sistema_usuario_id and '/sistema/usuarios/' in path and path.endswith('/habilitar'):
        return sistema.habilitar(sistema_usuario_id)

    if method == 'DELETE' and sistema_usuario_id and '/sistema/usuarios/' in path:
        return sistema.eliminar(sistema_usuario_id)

    # ── Inmobiliarias ─────────────────────────────────────────
    if method == 'GET' and path.endswith('/inmobiliarias'):
        return inmobiliarias.listar()

    if method == 'POST' and path.endswith('/inmobiliarias'):
        return inmobiliarias.crear(event)

    if method == 'PUT' and inmo_id and path.endswith(f'/{inmo_id}'):
        return inmobiliarias.actualizar(inmo_id, event)

    if method == 'PUT' and inmo_id and path.endswith('/deshabilitar') and not usuario_id:
        return inmobiliarias.deshabilitar(inmo_id)

    if method == 'PUT' and inmo_id and path.endswith('/habilitar') and not usuario_id:
        return inmobiliarias.habilitar(inmo_id)

    if method == 'DELETE' and inmo_id and path.endswith(f'/{inmo_id}') and not usuario_id:
        return inmobiliarias.eliminar(inmo_id)

    # ── Usuarios ──────────────────────────────────────────────
    if method == 'GET' and inmo_id and path.endswith('/usuarios'):
        return usuarios.listar(inmo_id)

    if method == 'POST' and inmo_id and path.endswith('/usuarios'):
        return usuarios.crear(inmo_id, event)

    if method == 'PUT' and usuario_id and path.endswith('/deshabilitar'):
        return usuarios.deshabilitar(usuario_id)

    if method == 'PUT' and usuario_id and path.endswith('/habilitar'):
        return usuarios.habilitar(usuario_id)

    if method == 'DELETE' and usuario_id and not '/sistema/' in path:
        return usuarios.eliminar(usuario_id)

    return not_found('Not found')


def _is_admin(event):
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub')
    if not sub:
        return False
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item')
    return item and item.get('rol') == 'admin'


def _get_rol(event):
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    sub = claims.get('sub')
    if not sub:
        return None
    table = dynamodb.Table(USUARIOS_TABLE)
    item = table.get_item(Key={'pk': f'USUARIO#{sub}', 'sk': 'METADATA'}).get('Item')
    return item.get('rol') if item else None
