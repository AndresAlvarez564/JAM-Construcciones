def get_claims(event):
    return event.get('requestContext', {}).get('authorizer', {}).get('claims', {})


def get_rol(event):
    groups = get_claims(event).get('cognito:groups', '')
    return 'admin' if 'admin' in groups else 'inmobiliaria'


def get_sub(event):
    return get_claims(event).get('sub')


def require_admin(event):
    return get_rol(event) == 'admin'
