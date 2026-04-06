# TK-05 - Captación de clientes y exclusividad por proyecto

## Objetivo

Registro de clientes potenciales por inmobiliaria con control de exclusividad
por proyecto durante 3 meses.

---

## Alcance

### Backend (`jam-captacion`)
- Endpoint para registrar un cliente con validación de exclusividad
- Validación de duplicidad por cédula/pasaporte + proyecto
- Vencimiento automático de exclusividad vía EventBridge Scheduler
- Consulta de clientes por inmobiliaria y por proyecto

### Frontend (React + Vite)
- Formulario de captación con todos los campos del cliente
- Alerta cuando el cliente ya está activo en otra inmobiliaria (mismo proyecto)
- Registro permitido si el cliente es en otro proyecto
- Vista de clientes captados por la inmobiliaria

---

## Campos del cliente

| Campo | Requerido | Notas |
|-------|-----------|-------|
| Nombres | Sí | |
| Apellidos | Sí | |
| Cédula o # de pasaporte | Sí | Clave de unicidad |
| Correo | No | Requerido para notificaciones |
| Teléfono | No | Requerido para WhatsApp |
| Estado civil | No | |
| Nacionalidad | No | |
| País de residencia | No | |
| Fecha de nacimiento | No | Calcula edad automáticamente |
| Edad | Auto | Calculado desde fecha de nacimiento |
| Inmobiliaria | Auto | Tomado del token de sesión |
| Proyecto | Sí | Seleccionado en el formulario |

---

## Lógica de exclusividad

```
Inmobiliaria registra cliente (cédula + proyecto)
        ↓
¿Existe registro activo con misma cédula + mismo proyecto?
        ↓ Sí
¿Es la misma inmobiliaria? → Sí → Actualizar datos, no duplicar
        ↓ No (otra inmobiliaria)
Alerta: "Este cliente está activo con otra inmobiliaria en este proyecto.
         Contacta a JAM Construcciones."
        → Rechazar registro (409)
        ↓ No existe registro activo
Registrar cliente con exclusividad de 3 meses
Programar vencimiento en EventBridge Scheduler
        ↓
Cliente queda en estado: captacion
```

- La exclusividad es por `cedula + proyecto`, no global
- El mismo cliente puede registrarse en otro proyecto sin restricción
- Al vencer los 3 meses: `exclusividad_activa = false`, cliente queda disponible
- El registro del cliente nunca se elimina, solo cambia su estado de exclusividad

---

## Modelo de datos

### Tabla: `jam-clientes`

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `CLIENTE#<cedula>` |
| sk | String | `PROYECTO#<proyecto_id>` |
| nombres | String | |
| apellidos | String | |
| cedula | String | Cédula o pasaporte |
| correo | String | |
| telefono | String | |
| estado_civil | String | |
| nacionalidad | String | |
| pais_residencia | String | |
| fecha_nacimiento | String | ISO date |
| inmobiliaria_id | String | Quién lo captó |
| proyecto_id | String | Proyecto asociado |
| estado | String | Ver estados abajo |
| exclusividad_activa | Boolean | true durante los 3 meses |
| fecha_captacion | String | ISO timestamp |
| fecha_vencimiento | String | fecha_captacion + 3 meses |
| unidad_id | String | Si viene desde un bloqueo |

### GSI

| GSI | pk | sk | Uso |
|-----|----|----|-----|
| `gsi-inmobiliaria-clientes` | `inmobiliaria_id` | `fecha_captacion` | Clientes por inmobiliaria |
| `gsi-proyecto-clientes` | `proyecto_id` | `estado` | Clientes por proyecto y estado |

---

## Estados del cliente

| Estado | Descripción |
|--------|-------------|
| `captacion` | Registrado, exclusividad activa |
| `disponible` | Exclusividad vencida, puede ser captado por otra inmobiliaria |
| `reserva` | Unidad reservada (TK-06 CRM) |
| `separacion` | En proceso de separación |
| `inicial` | En pago de cuotas iniciales |
| `desvinculado` | Proceso cancelado, historial preservado |

---

## Integración con bloqueos

- Si el cliente se registra desde el flujo de bloqueo (TK-04):
  - Se guarda con `unidad_id` referenciando la unidad bloqueada
  - Estado inicial: `captacion`
  - Solo pasa a `reserva` cuando la unidad se marca como vendida

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/clientes` | inmobiliaria | Registrar nuevo cliente |
| `GET` | `/clientes` | inmobiliaria | Listar clientes propios |
| `GET` | `/clientes/{cedula}/proyecto/{id}` | admin | Ver cliente en proyecto |
| `PUT` | `/admin/clientes/{cedula}/proyecto/{id}` | admin | Editar datos del cliente |
| `GET` | `/admin/clientes` | admin | Ver todos los clientes |

---

## Criterios de aceptación

- [ ] El sistema registra clientes con los campos definidos
- [ ] Un cliente activo no puede ser duplicado por otra inmobiliaria en el mismo proyecto
- [ ] El mismo cliente sí puede registrarse en otro proyecto
- [ ] La exclusividad vence automáticamente a los 3 meses vía EventBridge
- [ ] El historial del cliente se conserva aunque venza la exclusividad
- [ ] El formulario calcula la edad automáticamente desde la fecha de nacimiento
- [ ] La inmobiliaria se asigna automáticamente desde el token de sesión

---

## Notas técnicas

- La clave de unicidad es `cedula + proyecto_id` (pk + sk en DynamoDB)
- EventBridge Scheduler one-time al registrar para el vencimiento de exclusividad
- Admin puede editar cualquier campo del cliente; inmobiliaria solo puede registrar
- Depende de: TK-01 (auth), TK-02 (modelo), TK-04 (bloqueos)
