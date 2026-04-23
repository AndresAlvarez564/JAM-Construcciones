from utils.auth import get_rol, require_admin
from utils.response import forbidden, not_found
from routes import proyectos, etapas, unidades


def handler(event, context):
    method = event.get('httpMethod')
    path = event.get('path', '')
    rol = get_rol(event)
    path_params = event.get('pathParameters') or {}
    proyecto_id = path_params.get('proyecto_id')
    unidad_id = path_params.get('unidad_id')
    etapa_id = path_params.get('etapa_id')
    is_admin = '/admin/' in path or path.startswith('/admin/')

    # ===== LECTURA =====

    if method == 'GET' and path == '/proyectos':
        return proyectos.listar(event)

    if method == 'GET' and proyecto_id and path.endswith(f'/{proyecto_id}'):
        return proyectos.detalle(proyecto_id)

    if method == 'GET' and path.endswith('/etapas'):
        return etapas.listar(proyecto_id)

    if method == 'GET' and proyecto_id and path.endswith('/unidades'):
        return unidades.listar(proyecto_id, event, rol)

    if method == 'GET' and unidad_id:
        return unidades.detalle(proyecto_id, unidad_id, rol)

    # ===== ADMIN: guard =====
    if is_admin and not require_admin(event):
        return forbidden()

    # ===== PROYECTOS =====

    if method == 'POST' and path == '/admin/proyectos':
        return proyectos.crear(event)

    if method == 'PUT' and proyecto_id and path.endswith(f'/{proyecto_id}') and is_admin:
        return proyectos.actualizar(proyecto_id, event)

    if method == 'DELETE' and proyecto_id and path.endswith(f'/{proyecto_id}') and is_admin:
        return proyectos.eliminar(proyecto_id)

    if method == 'POST' and path.endswith('/imagen') and is_admin:
        return proyectos.presigned_imagen(proyecto_id, event)

    # ===== ETAPAS =====

    if method == 'POST' and path.endswith('/etapas') and is_admin:
        return etapas.crear(proyecto_id, event)

    if method == 'PUT' and etapa_id and is_admin:
        return etapas.actualizar(proyecto_id, etapa_id, event)

    if method == 'DELETE' and etapa_id and is_admin:
        return etapas.eliminar(proyecto_id, etapa_id)

    # ===== UNIDADES =====

    if method == 'POST' and path.endswith('/unidades') and is_admin:
        return unidades.crear(proyecto_id, event)

    if method == 'PUT' and unidad_id and is_admin:
        return unidades.actualizar(proyecto_id, unidad_id, event)

    if method == 'DELETE' and unidad_id and is_admin:
        return unidades.eliminar(proyecto_id, unidad_id)

    return not_found()
