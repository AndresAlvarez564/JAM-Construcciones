# TK-08 - Notificaciones operativas y trazabilidad de eventos clave

## Objetivo

Automatizar notificaciones ante eventos críticos del sistema y registrar un historial
de auditoría que permita identificar quién ejecutó cada acción principal.

---

## Alcance

### Backend (`jam-crm`)
- Lambda consumidora de SQS `jam-notificaciones-queue`
- Envío de emails vía proveedor externo (Resend u otro)
- Registro de cada evento en tabla de auditoría `jam-auditoria`
- Todos los módulos publican a SQS, esta Lambda centraliza el despacho

### Infraestructura
- SQS: `jam-notificaciones-queue` como cola central de eventos
- Dead Letter Queue (DLQ): `jam-notificaciones-dlq` para mensajes fallidos
- EventBridge Scheduler: dispara alertas programadas (5h antes de vencer bloqueo, vencimiento de exclusividad)

---

## Eventos cubiertos

| Evento | Origen | Destinatario | Canal |
|--------|--------|-------------|-------|
| Bloqueo registrado | TK-04 | Inmobiliaria + admin | Email |
| 5h antes de liberar bloqueo | TK-04 (EventBridge) | Inmobiliaria + admin | Email |
| Bloqueo liberado automáticamente | TK-04 | Inmobiliaria | Email |
| Bloqueo liberado manualmente por admin | TK-04 | Inmobiliaria | Email |
| Cliente captado | TK-05 | Interno (admin) | Email |
| Intento de duplicado de cliente | TK-05 | Admin | Email |
| Exclusividad vencida | TK-05 (EventBridge) | Admin | Email |
| Cambio de estatus: reserva | TK-06 | Cliente + corredor | Email + WhatsApp |
| Cambio de estatus: separacion | TK-06 | Cliente + corredor | Email + WhatsApp |
| Cambio de estatus: inicial | TK-06 | Cliente + corredor | Email + WhatsApp |
| Cambio de estatus: desvinculado | TK-06 | Cliente + corredor | Email + WhatsApp |
| Carga de inventario completada | TK-07 | Admin | Email |
| Carga de inventario con errores | TK-07 | Admin | Email |

> Las notificaciones al cliente solo se envían si tiene correo o teléfono registrado.
> Canales externos (WhatsApp API, Email): costos de consumo a cargo del cliente.

---

## Estructura del mensaje en SQS

```json
{
  "tipo_evento": "bloqueo_registrado",
  "timestamp": "2025-01-01T10:00:00Z",
  "ejecutado_por": "USUARIO#abc123",
  "entidad": "UNIDAD#A-101",
  "proyecto_id": "PROYECTO#001",
  "inmobiliaria_id": "INMOBILIARIA#xyz",
  "metadata": {
    "fecha_liberacion": "2025-01-03T10:00:00Z"
  },
  "notificar_cliente": true,
  "destinatarios": ["correo@ejemplo.com"]
}
```

---

## Modelo de auditoría

### Tabla: `jam-auditoria`

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `ENTIDAD#<tipo>#<id>` |
| sk | String | `EVENTO#<timestamp>` |
| tipo_evento | String | Identificador del evento |
| ejecutado_por | String | ID del usuario o sistema |
| proyecto_id | String | Proyecto relacionado |
| inmobiliaria_id | String | Inmobiliaria relacionada si aplica |
| detalle | Map | Datos adicionales del evento |
| timestamp | String | ISO timestamp UTC |

### GSI

| GSI | pk | sk | Uso |
|-----|----|----|-----|
| `gsi-auditoria-usuario` | `ejecutado_por` | `timestamp` | Acciones por usuario |
| `gsi-auditoria-proyecto` | `proyecto_id` | `timestamp` | Eventos por proyecto |

---

## Manejo de fallos

- DLQ captura mensajes que fallaron 3 veces consecutivas
- Admin puede revisar mensajes en DLQ desde consola AWS
- El fallo de notificación no revierte la operación que lo originó
- Cada intento de envío queda registrado en `jam-auditoria` con su resultado

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/admin/auditoria` | admin | Consultar historial de eventos |
| `GET` | `/admin/auditoria/{entidad_id}` | admin | Eventos de una entidad específica |

Filtros disponibles: `tipo_evento`, `proyecto_id`, `ejecutado_por`, rango de fechas

---

## Criterios de aceptación

- [ ] Todos los eventos definidos generan un registro en `jam-auditoria`
- [ ] Las notificaciones por email se envían en los momentos esperados
- [ ] Los mensajes fallidos van a DLQ sin afectar la operación principal
- [ ] El historial permite identificar quién ejecutó cada acción con fecha y detalle
- [ ] Admin puede consultar la auditoría filtrada por entidad, proyecto o usuario

---

## Notas técnicas

- SQS centraliza todos los eventos, evita acoplamiento directo entre módulos
- Visibilidad de mensajes en SQS: 30 segundos antes de reintento
- Retención de mensajes en DLQ: 14 días
- Proveedor de email (Resend u otro) configurado por variable de entorno por stage
- Depende de: TK-01 (auth), TK-02 (modelo de datos), TK-04 (bloqueos), TK-05 (captación), TK-06 (estatus)
