from utils.auth import require_admin
from utils.response import forbidden, not_found
from routes import clientes, scheduler_handler


def handler(event, context):
    # Eventos de EventBridge Scheduler
    if 'accion' in event:
        return scheduler_handler.handle(event)

    method = event.get('httpMethod')
    path = event.get('path', '')
    path_params = event.get('pathParameters') or {}
    cedula = path_params.get('cedula')
    proyecto_id = path_params.get('proyecto_id')
    is_admin = '/admin/' in path or path.startswith('/admin/')

    # ===== INMOBILIARIA =====

    if method == 'POST' and path == '/clientes':
        return clientes.registrar(event)

    if method == 'GET' and path == '/clientes':
        return clientes.listar(event)

    if method == 'GET' and cedula and path == f'/clientes/{cedula}':
        return clientes.buscar_por_cedula(event, cedula)

    # ===== ADMIN: guard =====
    if is_admin and not require_admin(event):
        return forbidden()

    if method == 'GET' and path == '/admin/clientes':
        return clientes.listar_admin(event)

    if method == 'GET' and cedula and proyecto_id:
        return clientes.detalle_admin(event, cedula, proyecto_id)

    if method == 'PUT' and cedula and proyecto_id:
        return clientes.actualizar_admin(event, cedula, proyecto_id)

    return not_found()
