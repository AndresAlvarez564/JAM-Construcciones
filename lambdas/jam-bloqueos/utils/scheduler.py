import boto3
import json
import os

scheduler = boto3.client('scheduler')

LAMBDA_ARN = os.environ.get('BLOQUEOS_LAMBDA_ARN', '')
SCHEDULER_ROLE_ARN = os.environ.get('SCHEDULER_ROLE_ARN', '')


def _schedule_name(unidad_id, suffix):
    # EventBridge Scheduler no permite '/' ni '#' en nombres
    safe = unidad_id.replace('/', '-').replace('#', '-')
    return f"bloqueo-{safe}-{suffix}"


def crear_schedules(unidad_id, proyecto_id, ts_liberacion_iso, ts_alerta_iso):
    """
    Crea dos schedules one-time:
      - liberacion: a las 48h → dispara acción 'liberar_automatico'
      - alerta:     a las 43h → dispara acción 'alerta_vencimiento'
    """
    if not LAMBDA_ARN or not SCHEDULER_ROLE_ARN:
        print(f'crear_schedules: LAMBDA_ARN o SCHEDULER_ROLE_ARN no configurados, omitiendo schedules para {unidad_id}')
        return

    payload_base = {'unidad_id': unidad_id, 'proyecto_id': proyecto_id}

    for suffix, at_time, accion in [
        ('alerta', ts_alerta_iso, 'alerta_vencimiento'),
        ('liberacion', ts_liberacion_iso, 'liberar_automatico'),
    ]:
        try:
            scheduler.create_schedule(
                Name=_schedule_name(unidad_id, suffix),
                ScheduleExpression=f"at({at_time})",
                ScheduleExpressionTimezone='UTC',
                FlexibleTimeWindow={'Mode': 'OFF'},
                Target={
                    'Arn': LAMBDA_ARN,
                    'RoleArn': SCHEDULER_ROLE_ARN,
                    'Input': json.dumps({**payload_base, 'accion': accion}),
                },
                ActionAfterCompletion='DELETE',
            )
        except Exception as e:
            print(f'crear_schedules error ({suffix}): {type(e).__name__}: {e}')


def eliminar_schedules(unidad_id):
    """Elimina los schedules pendientes al liberar manualmente."""
    for suffix in ('alerta', 'liberacion'):
        try:
            scheduler.delete_schedule(Name=_schedule_name(unidad_id, suffix))
        except scheduler.exceptions.ResourceNotFoundException:
            pass
