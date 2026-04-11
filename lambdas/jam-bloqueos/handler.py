from utils.auth import require_admin, get_rol
from utils.response import forbidden, not_found, bad_request
from routes import bloqueos, admin_bloqueos, scheduler_handler


def handler(event, context):
    # Eventos de EventBridge Scheduler (no tienen httpMethod)
    if 'accion' in event:
        return scheduler_handler.handle(event)

    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    unidad_id = path_params.get('unidad_id')
    qs = event.get('queryStringParameters') or {}
    proyecto_id = qs.get('proyecto_id')

    is_admin = '/admin/' in path or path.startswith('/admin/')

    # ===== INMOBILIARIA =====

    if method == 'POST' and path == '/bloqueos':
        return bloqueos.bloquear(event)

    # ===== ADMIN: guard =====
    if is_admin and not require_admin(event):
        return forbidden()

    if method == 'GET' and path == '/bloqueos/activos':
        return bloqueos.listar_activos(event)

    if method == 'DELETE' and unidad_id and '/admin/bloqueos/' in path:
        return admin_bloqueos.liberar(proyecto_id, unidad_id, event)

    if method == 'PUT' and unidad_id and path.endswith('/extender'):
        return admin_bloqueos.extender(proyecto_id, unidad_id, event)

    return not_found()
