# TK-04 - Bloqueo de unidades con control de concurrencia y liberación automática

## Objetivo

Implementar el flujo central de bloqueo de unidades por 48 horas, evitando conflictos
entre corredores y garantizando la liberación automática del inventario.

---

## Alcance

### Backend (`jam-bloqueos`)
- Endpoint para bloquear una unidad con validación de disponibilidad
- Control de concurrencia con escritura condicional en DynamoDB
- Restricción de re-bloqueo por la misma inmobiliaria antes de 24h
- Liberación automática vía EventBridge Scheduler
- Endpoints administrativos para liberar o extender bloqueos

### Eventos / Mensajería
- SQS: cola `jam-notificaciones-queue` para emails de bloqueo y alerta de vencimiento
- EventBridge Scheduler: tarea programada a las 48h para liberar y a las 43h para alertar (5h antes)

---

## Flujo de bloqueo

```
Inmobiliaria solicita bloqueo
        ↓
¿Unidad disponible? → No → Rechazar (409 Conflict)
        ↓ Sí
¿Misma inmobiliaria bloqueó hace menos de 24h? → Sí → Rechazar (429)
        ↓ No
Escritura condicional en DynamoDB (ConditionExpression: estado = disponible)
        ↓
¿Condición cumplida? → No (otro ganó la carrera) → Rechazar (409)
        ↓ Sí
Guardar bloqueo con timestamp exacto
Programar liberación en EventBridge (48h)
Programar alerta en EventBridge (43h)
Enviar email a SQS → Lambda notificaciones
        ↓
Respuesta 200 con datos del bloqueo
```

---

## Control de concurrencia

El doble bloqueo se previene con `ConditionExpression` de DynamoDB:

```python
table.update_item(
    Key={"pk": f"PROYECTO#{proyecto_id}", "sk": f"UNIDAD#{unidad_id}"},
    UpdateExpression="SET estado = :bloqueada, bloqueado_por = :inmo, fecha_bloqueo = :ts, fecha_liberacion = :lib",
    ConditionExpression="estado = :disponible",
    ExpressionAttributeValues={
        ":bloqueada": "bloqueada",
        ":disponible": "disponible",
        ":inmo": inmobiliaria_id,
        ":ts": timestamp_ahora,
        ":lib": timestamp_48h,
    }
)
```

Si la condición falla (`ConditionalCheckFailedException`), significa que otro request
ganó la carrera → se retorna 409.

---

## Restricción de re-bloqueo

- Una inmobiliaria no puede bloquear la misma unidad si la liberó hace menos de 24h
- Se valida consultando el historial de bloqueos en `jam-historial-bloqueos`

## Relación con clientes

| Caso | Comportamiento |
|------|---------------|
| Bloqueo con cliente registrado | Se guarda como captación con `unidad_id` |
| Unidad pasa a `no_disponible` | Cliente se convierte en cliente activo (`reserva`) |
| Bloqueo sin cliente | Admin puede asignar cliente manualmente |

---

## Liberación automática

- EventBridge Scheduler crea una tarea al momento del bloqueo con target a `jam-bloqueos`
- A las 48h: actualiza estado a `disponible`, limpia `bloqueado_por` y `cliente_id` si no hay venta
- A las 43h (5h antes): dispara notificación de alerta a inmobiliaria y admin vía SQS

---

## Acciones administrativas

| Acción | Endpoint | Descripción |
|--------|----------|-------------|
| Liberar bloqueo | `DELETE /admin/bloqueos/{unidad_id}` | Libera manualmente antes de las 48h |
| Extender bloqueo | `PUT /admin/bloqueos/{unidad_id}/extender` | Extiende el tiempo, requiere justificación |

Ambas acciones quedan registradas en el historial con el admin que las ejecutó.

---

## Modelo de historial

### Tabla: `jam-historial-bloqueos`

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `UNIDAD#<id>` |
| sk | String | `BLOQUEO#<timestamp>` |
| proyecto_id | String | Referencia al proyecto |
| inmobiliaria_id | String | Quién bloqueó |
| cliente_id | String | Cliente asociado si aplica |
| fecha_bloqueo | String | ISO timestamp inicio |
| fecha_liberacion | String | ISO timestamp fin real |
| motivo_liberacion | String | `automatica`, `manual`, `venta` |
| liberado_por | String | Admin si fue manual |

---

## Notificaciones (vía SQS)

| Evento | Destinatario | Canal |
|--------|-------------|-------|
| Bloqueo registrado | Inmobiliaria + admin interno | Email |
| 5h antes de vencer | Inmobiliaria + admin interno | Email |
| Liberación automática | Inmobiliaria | Email |
| Liberación manual por admin | Inmobiliaria | Email |

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/bloqueos` | inmobiliaria | Bloquear una unidad |
| `GET` | `/bloqueos/activos` | admin | Ver todos los bloqueos activos |
| `DELETE` | `/admin/bloqueos/{unidad_id}` | admin | Liberar manualmente |
| `PUT` | `/admin/bloqueos/{unidad_id}/extender` | admin | Extender bloqueo |

---

## Criterios de aceptación

- [ ] Una unidad no puede quedar bloqueada por dos corredores al mismo tiempo
- [ ] El primer request válido gana, los demás reciben 409
- [ ] La misma inmobiliaria no puede re-bloquear la misma unidad antes de 24h
- [ ] El bloqueo expira automáticamente a las 48h vía EventBridge
- [ ] Se envían notificaciones al bloquear y 5h antes de vencer
- [ ] Admin puede liberar o extender con trazabilidad completa
- [ ] Todo queda registrado en `jam-historial-bloqueos`

---

## Notas técnicas

- `ConditionExpression` en DynamoDB es la única garantía real contra race conditions
- EventBridge Scheduler (no EventBridge Rules) para tareas one-time por bloqueo
- Depende de: TK-01 (auth), TK-02 (modelo de datos)
