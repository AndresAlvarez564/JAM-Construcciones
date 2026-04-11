def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


def get_rol(event):
    claims = get_claims(event)
    groups = claims.get('cognito:groups', '')
    return 'admin' if 'admin' in groups else 'inmobiliaria'


def get_inmobiliaria_id(event):
    """Retorna el inmobiliaria_id del token (sub del usuario)."""
    claims = get_claims(event)
    return claims.get('custom:inmobiliaria_id') or claims.get('sub')


def require_admin(event):
    return get_rol(event) == 'admin'
