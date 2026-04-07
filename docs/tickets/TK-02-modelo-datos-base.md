# TK-02 - Modelo de datos base: proyectos, etapas, torres y unidades

## Objetivo

Construir la estructura base de datos para soportar proyectos, inventario, torres,
etapas y unidades con sus atributos fundamentales.

---

## Entidades principales

### Proyecto
Representa un desarrollo inmobiliario completo.

### Etapa
Una fase dentro de un proyecto (ej: Etapa 1, Etapa 2).

### Torre / Bloque
Agrupación de unidades dentro de una etapa (ej: Torre A, Torre B).

### Unidad
Unidad individual en venta (apartamento, local, etc.).

---

## Modelo DynamoDB (Single Table Design)

### Tabla: `jam-inventario`

| pk | sk | Entidad |
|----|-----|---------|
| `PROYECTO#<id>` | `METADATA` | Proyecto |
| `PROYECTO#<id>` | `ETAPA#<id>` | Etapa dentro del proyecto |
| `PROYECTO#<id>` | `TORRE#<id>` | Torre dentro del proyecto |
| `PROYECTO#<id>` | `UNIDAD#<id>` | Unidad dentro del proyecto |

#### Atributos: Proyecto
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `METADATA` |
| nombre | String | Nombre del proyecto |
| descripcion | String | Descripción opcional |
| activo | Boolean | Proyecto habilitado |
| creado_en | String | ISO timestamp |

#### Atributos: Etapa
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `ETAPA#<id>` |
| nombre | String | Nombre de la etapa |
| orden | Number | Orden de visualización |
| activo | Boolean | Etapa habilitada |

#### Atributos: Torre
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `TORRE#<id>` |
| nombre | String | Nombre del bloque (ej: Torre A) |
| etapa_id | String | Referencia a la etapa |
| orden | Number | Orden de visualización |
| activo | Boolean | Torre habilitada |

#### Atributos: Unidad
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `PROYECTO#<id>` |
| sk | String | `UNIDAD#<id>` |
| id_unidad | String | Identificador legible (ej: A-101) |
| etapa_id | String | Referencia a la etapa |
| torre_id | String | Referencia a la torre |
| metraje | Number | m² |
| precio | Number | Valor de la unidad |
| estado | String | Estado actual (default: `disponible`) |
| bloqueado_por | String | inmobiliaria_id que bloqueó (TK-04) |
| cliente_id | String | Referencia al cliente asociado (TK-05) |
| fecha_bloqueo | String | ISO timestamp inicio bloqueo (TK-04) |
| fecha_liberacion | String | ISO timestamp fin bloqueo (TK-04) |
| creado_en | String | ISO timestamp |
| actualizado_en | String | ISO timestamp |

---

## Estados de unidad

| Estado | Descripción |
|--------|-------------|
| `disponible` | Unidad disponible en inventario |
| `bloqueada` | Bloqueada por inmobiliaria por 48h (TK-04) |
| `no_disponible` | Reservada / en proceso de venta (TK-06) |
| `vendida` | Venta cerrada |
| `desvinculada` | Proceso cancelado, unidad liberada (TK-06) |

---

## Índices secundarios (GSI)

| GSI | pk | sk | Uso |
|-----|----|----|-----|
| `gsi-torre` | `torre_id` | `sk` | Consultar unidades por torre |
| `gsi-estado` | `estado` | `creado_en` | Consultar unidades por estado |

Nota: GSI adicionales como `gsi-inmobiliaria` se agregarán en TK-04 cuando se implemente el sistema de bloqueos.

---

## Endpoints base (Lambda Python)

### Lectura (autenticados)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/proyectos` | Listar proyectos activos |
| `GET` | `/proyectos/{id}` | Detalle de un proyecto |
| `GET` | `/proyectos/{id}/etapas` | Listar etapas de un proyecto |
| `GET` | `/proyectos/{id}/torres` | Listar torres de un proyecto |
| `GET` | `/proyectos/{id}/unidades` | Listar unidades (filtros: `estado`, `torre_id`, `etapa_id`) |
| `GET` | `/proyectos/{id}/unidades/{unidad_id}` | Detalle de una unidad |

### Administración (solo admin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/admin/proyectos` | Crear proyecto |
| `PUT` | `/admin/proyectos/{id}` | Editar proyecto |
| `DELETE` | `/admin/proyectos/{id}` | Eliminar proyecto (soft delete: `activo=false`) |
| `POST` | `/admin/proyectos/{id}/etapas` | Crear etapa |
| `PUT` | `/admin/proyectos/{id}/etapas/{etapa_id}` | Editar etapa |
| `DELETE` | `/admin/proyectos/{id}/etapas/{etapa_id}` | Eliminar etapa |
| `POST` | `/admin/proyectos/{id}/torres` | Crear torre |
| `PUT` | `/admin/proyectos/{id}/torres/{torre_id}` | Editar torre |
| `DELETE` | `/admin/proyectos/{id}/torres/{torre_id}` | Eliminar torre |
| `POST` | `/admin/proyectos/{id}/unidades` | Crear unidad |
| `PUT` | `/admin/proyectos/{id}/unidades/{unidad_id}` | Editar unidad |
| `DELETE` | `/admin/proyectos/{id}/unidades/{unidad_id}` | Eliminar unidad |

---

## Criterios de aceptación

- [ ] La tabla `jam-inventario` está creada en DynamoDB con la estructura definida
- [ ] Se pueden crear, editar y eliminar proyectos
- [ ] Se pueden crear, editar y eliminar etapas asociadas a un proyecto
- [ ] Se pueden crear, editar y eliminar torres asociadas a un proyecto y etapa
- [ ] Se pueden crear, editar y eliminar unidades con todos sus atributos
- [ ] Los endpoints de lectura permiten listar y consultar proyectos, etapas, torres y unidades
- [ ] Los filtros por `estado`, `torre_id` y `etapa_id` funcionan en el listado de unidades
- [ ] Los GSI `gsi-torre` y `gsi-estado` funcionan correctamente
- [ ] Todas las unidades se crean con estado `disponible` por defecto
- [ ] El eliminado de proyectos es soft delete (`activo=false`)
- [ ] Los endpoints de admin están protegidos por autenticación (TK-01)
- [ ] El frontend muestra proyectos como tarjetas seleccionables (no lista desplegable)
- [ ] El frontend permite crear, editar y eliminar etapas y torres desde la vista de inventario
- [ ] El frontend permite crear, editar y eliminar unidades desde la vista de inventario

---

## Notas técnicas

- Single Table Design en DynamoDB para minimizar costos y latencia
- Todos los timestamps en ISO 8601 UTC
- El campo `estado` inicia siempre en `disponible`
- La estructura está diseñada para ser extensible: campos adicionales se agregarán en tickets posteriores sin necesidad de migraciones
- Los IDs se generan con UUID v4
- Eliminado de proyectos es soft delete; etapas, torres y unidades se eliminan físicamente (`delete_item`)
- Al eliminar una etapa o torre, validar que no tenga unidades activas asociadas antes de proceder
- Depende de: TK-01 (autenticación y autorización)
