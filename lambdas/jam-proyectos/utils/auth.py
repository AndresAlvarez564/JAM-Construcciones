def get_rol(event):
    claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
    groups = claims.get('cognito:groups', '')
    return 'admin' if 'admin' in groups else 'inmobiliaria'


def require_admin(event):
    """Retorna True si es admin, False si no."""
    return get_rol(event) == 'admin'
