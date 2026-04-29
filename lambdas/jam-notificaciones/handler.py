"""Lambda consumidora de SQS — envía notificaciones por email vía AWS SES."""
import json
import boto3
import os
import logging
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
ses = boto3.client('ses', region_name=os.environ.get('AWS_REGION', 'us-east-1'))

USUARIOS_TABLE = os.environ['USUARIOS_TABLE']
CLIENTES_TABLE = os.environ['CLIENTES_TABLE']
INVENTARIO_TABLE = os.environ.get('INVENTARIO_TABLE', '')
ADMIN_EMAIL = os.environ['ADMIN_EMAIL']
FROM_EMAIL = os.environ['FROM_EMAIL']

usuarios = dynamodb.Table(USUARIOS_TABLE)
clientes_table = dynamodb.Table(CLIENTES_TABLE)
inventario_table = dynamodb.Table(INVENTARIO_TABLE) if INVENTARIO_TABLE else None


def handler(event, context):
    for record in event.get('Records', []):
        try:
            body = json.loads(record['body'])
            _procesar(body)
        except Exception as e:
            logger.error(f'Error procesando mensaje: {e}', exc_info=True)
            raise


def _procesar(msg):
    tipo = msg.get('tipo') or msg.get('evento')
    if not tipo:
        logger.warning(f'Mensaje sin tipo/evento: {msg}')
        return

    logger.info(f'Procesando evento: {tipo}')

    handlers = {
        'bloqueo_registrado':        _bloqueo_registrado,
        'alerta_vencimiento':        _alerta_vencimiento,
        'liberacion_automatica':     _liberacion_automatica,
        'liberacion_manual':         _liberacion_manual,
        'cambio_estatus':            _cambio_estatus,
        'alerta_separacion_vencida': _alerta_separacion_vencida,
        'cliente_captado':           _cliente_captado,
        'exclusividad_vencida':      _exclusividad_vencida,
        'intento_duplicado':         _intento_duplicado,
    }

    fn = handlers.get(tipo)
    if fn:
        fn(msg)
    else:
        logger.warning(f'Tipo de evento no manejado: {tipo}')


# ─── Resolvers ───────────────────────────────────────────────────────────────

def _correos_inmobiliaria(inmobiliaria_id):
    if not inmobiliaria_id:
        return []
    inmo_id = inmobiliaria_id.replace('INMOBILIARIA#', '')
    item = usuarios.get_item(
        Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('correos', [])


def _nombre_inmobiliaria(inmobiliaria_id):
    if not inmobiliaria_id:
        return inmobiliaria_id or ''
    inmo_id = inmobiliaria_id.replace('INMOBILIARIA#', '')
    item = usuarios.get_item(
        Key={'pk': f'INMOBILIARIA#{inmo_id}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('nombre', inmo_id)


def _nombre_proyecto(proyecto_id):
    if not proyecto_id or not inventario_table:
        return proyecto_id or ''
    pid = proyecto_id.replace('PROYECTO#', '')
    item = inventario_table.get_item(
        Key={'pk': f'PROYECTO#{pid}', 'sk': 'METADATA'}
    ).get('Item', {})
    return item.get('nombre', pid)


def _correo_cliente(cedula, inmobiliaria_id, proyecto_id):
    inmo_id = (inmobiliaria_id or '').replace('INMOBILIARIA#', '')
    pk = f'CLIENTE#{cedula}#{inmo_id}'
    sk = f'PROYECTO#{proyecto_id}'
    item = clientes_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item', {})
    return item.get('correo', '')


def _nombre_cliente(cedula, inmobiliaria_id, proyecto_id=''):
    """Retorna 'Nombres Apellidos (cédula)' o solo la cédula si no se encuentra."""
    if not cedula:
        return ''
    inmo_id = (inmobiliaria_id or '').replace('INMOBILIARIA#', '')
    pk = f'CLIENTE#{cedula}#{inmo_id}'
    # Intentar con proyecto específico primero, luego sin sk
    item = {}
    if proyecto_id:
        sk = f'PROYECTO#{proyecto_id}'
        item = clientes_table.get_item(Key={'pk': pk, 'sk': sk}).get('Item', {})
    if not item:
        # Buscar cualquier registro del cliente en esa inmobiliaria
        resp = clientes_table.query(
            KeyConditionExpression=Key('pk').eq(pk),
            Limit=1
        )
        items = resp.get('Items', [])
        item = items[0] if items else {}
    nombres = item.get('nombres', '')
    apellidos = item.get('apellidos', '')
    nombre_completo = f'{nombres} {apellidos}'.strip()
    return f'{nombre_completo} ({cedula})' if nombre_completo else cedula


def _firma():
    return '''
    <br>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0">
    <table style="width:100%">
      <tr>
        <td>
          <p style="margin:0;font-weight:600;color:#1a1a1a">JAM Construcciones</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666">Sistema de Gestión Inmobiliaria</p>
          <p style="margin:4px 0 0;font-size:12px;color:#999">Este es un mensaje automático, no responder a este correo.</p>
        </td>
      </tr>
    </table>
    '''


def _wrap(contenido):
    return f'''
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
      <div style="background:#1a5276;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">JAM Construcciones</h2>
        <p style="margin:4px 0 0;color:#aed6f1;font-size:13px">Sistema de Gestión Inmobiliaria</p>
      </div>
      <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        {contenido}
        {_firma()}
      </div>
    </div>
    '''


def _enviar(destinatarios, asunto, cuerpo_html):
    destinatarios = [d for d in destinatarios if d]
    if not destinatarios:
        logger.warning('Sin destinatarios, email no enviado')
        return

    ses.send_email(
        Source=FROM_EMAIL,
        Destination={'ToAddresses': destinatarios},
        Message={
            'Subject': {'Data': f'[JAM] {asunto}', 'Charset': 'UTF-8'},
            'Body': {'Html': {'Data': _wrap(cuerpo_html), 'Charset': 'UTF-8'}},
        },
    )
    logger.info(f'Email enviado a {destinatarios}: {asunto}')


# ─── Handlers por evento ─────────────────────────────────────────────────────

def _bloqueo_registrado(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id) + [ADMIN_EMAIL]
    unidad = meta.get('unidad_nombre') or meta.get('unidad_id', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha_bloqueo = meta.get('fecha_bloqueo', '')
    fecha_liberacion = meta.get('fecha_liberacion', '')
    cliente_cedula = meta.get('cliente_cedula', '')
    horas = meta.get('horas', 48)

    filas_cliente = f'<tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;font-weight:500">{_nombre_cliente(cliente_cedula, inmo_id, msg.get("proyecto_id", ""))}</td></tr>' if cliente_cedula else ''
    fecha_bloqueo_fmt = fecha_bloqueo[:19].replace("T", " ") + " UTC" if fecha_bloqueo else ''
    fecha_liberacion_fmt = fecha_liberacion[:19].replace("T", " ") + " UTC" if fecha_liberacion else ''
    fila_fecha_bloqueo = f'<tr><td style="padding:6px 0;color:#666">Fecha de bloqueo</td><td style="padding:6px 0;font-weight:500">{fecha_bloqueo_fmt}</td></tr>' if fecha_bloqueo_fmt else ''
    fila_fecha_vence = f'<tr><td style="padding:6px 0;color:#666">Vence el</td><td style="padding:6px 0;font-weight:500">{fecha_liberacion_fmt}</td></tr>' if fecha_liberacion_fmt else ''

    _enviar(
        correos,
        f'Bloqueo registrado — {unidad}',
        f'''
        <h3 style="color:#1a5276;margin-top:0">Nuevo bloqueo registrado</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Unidad</td><td style="padding:6px 0;font-weight:500">{unidad}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          {filas_cliente}
          <tr><td style="padding:6px 0;color:#666">Duración</td><td style="padding:6px 0;font-weight:500">{horas} horas</td></tr>
          {fila_fecha_bloqueo}
          {fila_fecha_vence}
        </table>
        ''',
    )


def _alerta_vencimiento(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id) + [ADMIN_EMAIL]
    unidad = meta.get('unidad_nombre') or meta.get('unidad_id', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha_liberacion = meta.get('fecha_liberacion', '')
    
    # Formatear fecha de vencimiento
    fecha_formateada = ''
    if fecha_liberacion:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(fecha_liberacion.replace('Z', '+00:00'))
            fecha_formateada = dt.strftime('%d/%m/%Y %H:%M (hora local)')
        except:
            fecha_formateada = fecha_liberacion[:19].replace("T", " ") + " UTC"

    _enviar(
        correos,
        f'⚠️ Bloqueo próximo a vencer — {unidad}',
        f'''
        <h3 style="color:#e67e22;margin-top:0">⚠️ Alerta: bloqueo próximo a vencer</h3>
        <p>El siguiente bloqueo está próximo a vencer. Si necesitas más tiempo, comunícate con el administrador del sistema.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Unidad</td><td style="padding:6px 0;font-weight:500">{unidad}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Vence el</td><td style="padding:6px 0;font-weight:500">{fecha_formateada}</td></tr>
        </table>
        ''',
    )


def _liberacion_automatica(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id)
    unidad = meta.get('unidad_nombre') or meta.get('unidad_id', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha = meta.get('fecha_liberacion', '')
    
    # Formatear fecha de liberación
    fecha_formateada = ''
    if fecha:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(fecha.replace('Z', '+00:00'))
            fecha_formateada = dt.strftime('%d/%m/%Y %H:%M (hora local)')
        except:
            fecha_formateada = fecha[:19].replace("T", " ") + " UTC"

    _enviar(
        correos,
        f'Bloqueo liberado automáticamente — {unidad}',
        f'''
        <h3 style="color:#1a5276;margin-top:0">Bloqueo liberado por vencimiento</h3>
        <p>El tiempo de bloqueo expiró y la unidad quedó disponible automáticamente.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Unidad</td><td style="padding:6px 0;font-weight:500">{unidad}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Liberada el</td><td style="padding:6px 0;font-weight:500">{fecha_formateada}</td></tr>
        </table>
        ''',
    )


def _liberacion_manual(msg):
    meta = msg.get('metadata', {})
    inmo_id = msg.get('inmobiliaria_id', '')
    correos = _correos_inmobiliaria(inmo_id)
    unidad = meta.get('unidad_nombre') or meta.get('unidad_id', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    liberado_por = meta.get('liberado_por', 'Administrador')
    justificacion = meta.get('justificacion', '')
    cedula = meta.get('cedula', '')
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else ''

    fila_cliente = f'<tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;font-weight:500">{cliente}</td></tr>' if cliente else ''
    fila_just = f'<tr><td style="padding:6px 0;color:#666">Justificación</td><td style="padding:6px 0;font-weight:500">{justificacion}</td></tr>' if justificacion else ''

    _enviar(
        correos,
        f'Bloqueo liberado manualmente — {unidad}',
        f'''
        <h3 style="color:#1a5276;margin-top:0">Bloqueo liberado manualmente</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Unidad</td><td style="padding:6px 0;font-weight:500">{unidad}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          {fila_cliente}
          <tr><td style="padding:6px 0;color:#666">Liberado por</td><td style="padding:6px 0;font-weight:500">{liberado_por}</td></tr>
          {fila_just}
        </table>
        ''',
    )


def _cambio_estatus(msg):
    meta = msg.get('metadata', {})
    if not msg.get('notificar'):
        logger.info('cambio_estatus sin notificar=True, omitiendo email')
        return

    inmo_id = msg.get('inmobiliaria_id', '')
    cedula = meta.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    estatus_anterior = meta.get('estatus_anterior', '')
    nuevo_estatus = meta.get('nuevo_estatus', '')
    unidad = meta.get('unidad_nombre') or meta.get('unidad_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else ''

    correo_cliente = _correo_cliente(cedula, inmo_id, msg.get('proyecto_id', ''))
    correos_inmo = _correos_inmobiliaria(inmo_id)
    correos = ([correo_cliente] if correo_cliente else []) + correos_inmo

    fila_cliente = f'<tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;font-weight:500">{cliente}</td></tr>' if cliente else ''
    fila_anterior = f'<tr><td style="padding:6px 0;color:#666">Estatus anterior</td><td style="padding:6px 0;font-weight:500">{estatus_anterior}</td></tr>' if estatus_anterior else ''
    fila_nuevo = f'<tr><td style="padding:6px 0;color:#666">Nuevo estatus</td><td style="padding:6px 0;font-weight:500;color:#27ae60">{nuevo_estatus}</td></tr>' if nuevo_estatus else ''

    _enviar(
        correos,
        f'Actualización de estatus — {unidad}',
        f'''
        <h3 style="color:#1a5276;margin-top:0">Actualización de estatus de unidad</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Unidad</td><td style="padding:6px 0;font-weight:500">{unidad}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          {fila_cliente}
          {fila_anterior}
          {fila_nuevo}
        </table>
        ''',
    )


def _alerta_separacion_vencida(msg):
    meta = msg.get('metadata', {})
    cedula = meta.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    unidad = meta.get('unidad_nombre') or meta.get('unidad_id', '')
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    dias = meta.get('dias_sin_pago', 30)
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else cedula

    _enviar(
        [ADMIN_EMAIL],
        f'⚠️ Separación vencida — {cedula}',
        f'''
        <h3 style="color:#c0392b;margin-top:0">⚠️ Alerta: separación vencida sin pago</h3>
        <p>Han transcurrido <b>{dias} días</b> desde la separación sin registrar pago.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;font-weight:500">{cliente}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Unidad</td><td style="padding:6px 0;font-weight:500">{unidad}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
        </table>
        ''',
    )


def _cliente_captado(msg):
    meta = msg.get('metadata', {})
    nombres = meta.get('nombres', '')
    apellidos = meta.get('apellidos', '')
    cedula = meta.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    fecha = msg.get('timestamp', '')
    fecha_fmt = fecha[:19].replace("T", " ") + " UTC" if fecha else ''
    fila_fecha = f'<tr><td style="padding:6px 0;color:#666">Fecha</td><td style="padding:6px 0;font-weight:500">{fecha_fmt}</td></tr>' if fecha_fmt else ''

    _enviar(
        [ADMIN_EMAIL],
        f'Nuevo cliente captado — {nombres} {apellidos}',
        f'''
        <h3 style="color:#1a5276;margin-top:0">Nuevo cliente captado</h3>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Nombre</td><td style="padding:6px 0;font-weight:500">{nombres} {apellidos}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Cédula</td><td style="padding:6px 0;font-weight:500">{cedula}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          {fila_fecha}
        </table>
        ''',
    )


def _exclusividad_vencida(msg):
    meta = msg.get('metadata', {})
    cedula = meta.get('cedula', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    correos_inmo = _correos_inmobiliaria(inmo_id)
    cliente = _nombre_cliente(cedula, inmo_id, msg.get('proyecto_id', '')) if cedula else cedula

    _enviar(
        [ADMIN_EMAIL] + correos_inmo,
        f'Exclusividad vencida — {cedula}',
        f'''
        <h3 style="color:#e67e22;margin-top:0">Exclusividad de cliente vencida</h3>
        <p>El período de exclusividad de 3 meses ha expirado. La unidad quedó disponible para otras inmobiliarias.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;font-weight:500">{cliente}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
        </table>
        ''',
    )


def _intento_duplicado(msg):
    meta = msg.get('metadata', {})
    cedula = meta.get('cedula', '')
    nombres = meta.get('nombres', '')
    apellidos = meta.get('apellidos', '')
    proyecto = _nombre_proyecto(msg.get('proyecto_id', ''))
    inmo_id = msg.get('inmobiliaria_id', '')
    inmo_nombre = _nombre_inmobiliaria(inmo_id)
    cliente = f'{nombres} {apellidos} ({cedula})'.strip(' ()') if (nombres or apellidos) else cedula

    inmo_con_excl_id = meta.get('inmobiliaria_con_exclusividad', '')
    inmo_con_excl_nombre = _nombre_inmobiliaria(inmo_con_excl_id) if inmo_con_excl_id else 'Otra inmobiliaria'

    _enviar(
        [ADMIN_EMAIL],
        f'⚠️ Intento de captación duplicada — {cedula}',
        f'''
        <h3 style="color:#c0392b;margin-top:0">⚠️ Intento de captación duplicada bloqueado</h3>
        <p>Una inmobiliaria intentó captar un cliente que ya tiene exclusividad activa con otra inmobiliaria.</p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#666">Cliente</td><td style="padding:6px 0;font-weight:500">{cliente}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Proyecto</td><td style="padding:6px 0;font-weight:500">{proyecto}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria solicitante</td><td style="padding:6px 0;font-weight:500">{inmo_nombre}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Inmobiliaria con exclusividad</td><td style="padding:6px 0;font-weight:500;color:#c0392b">{inmo_con_excl_nombre}</td></tr>
        </table>
        ''',
    )
