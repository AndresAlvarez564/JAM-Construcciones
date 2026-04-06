# TK-02 - Modelo de datos base: proyectos, etapas, torres y unidades

## Objetivo

Construir la estructura base de datos para soportar proyectos, inventario, torres,
etapas y unidades, dejando todo listo para integrarse con captación, bloqueos y CRM.

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
| estado | String | Ver estados abajo |
| bloqueado_por | String | `inmobiliaria_id` si aplica |
| cliente_id | String | Referencia al cliente si aplica |
| fecha_bloqueo | String | ISO timestamp |
| fecha_liberacion | String | ISO timestamp |
| creado_en | String | ISO timestamp |
| actualizado_en | String | ISO timestamp |

---

## Estados de unidad

| Estado | Descripción |
|--------|-------------|
| `disponible` | Libre para bloquear o vender |
| `bloqueada` | Reservada temporalmente por una inmobiliaria (48h) |
| `no_disponible` | En proceso de venta activo |
| `vendida` | Venta cerrada |
| `desvinculada` | Proceso cancelado, unidad liberada con historial |

---

## Índices secundarios (GSI)

| GSI | pk | sk | Uso |
|-----|----|----|-----|
| `gsi-estado` | `estado` | `fecha_bloqueo` | Consultar unidades por estado |
| `gsi-torre` | `torre_id` | `sk` | Consultar unidades por torre |
| `gsi-inmobiliaria` | `bloqueado_por` | `sk` | Ver bloqueos activos por inmobiliaria |

---

## Endpoints base (Lambda Python)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/proyectos` | Listar proyectos activos |
| `GET` | `/proyectos/{id}/unidades` | Listar unidades de un proyecto |
| `GET` | `/proyectos/{id}/unidades/{unidad_id}` | Detalle de una unidad |
| `PUT` | `/proyectos/{id}/unidades/{unidad_id}/estado` | Actualizar estado de unidad |
| `POST` | `/admin/proyectos` | Crear proyecto (solo admin) |
| `POST` | `/admin/proyectos/{id}/torres` | Crear torre (solo admin) |

---

## Carga inicial de inventario

- Soporte para importación desde `.xlsx`
- El archivo se sube a S3, una Lambda lo procesa y carga las unidades en DynamoDB
- El sistema ordena automáticamente por torre (A, B, C...) según el campo correspondiente
- Los bloques se habilitan progresivamente: `activo = true` por torre o etapa

---

## Criterios de aceptación

- [ ] Se pueden registrar proyectos, etapas, torres y unidades desde backend
- [ ] Cada unidad queda correctamente asociada a su proyecto, etapa y torre
- [ ] Los estados de unidad pueden leerse y actualizarse
- [ ] Los GSI permiten consultas eficientes por estado, torre e inmobiliaria
- [ ] Estructura lista para integrarse con TK-03 (captación) y TK-04 (bloqueos)

---

## Notas técnicas

- Single Table Design en DynamoDB para minimizar costos y latencia
- Todos los timestamps en ISO 8601 UTC
- El campo `estado` es la fuente de verdad para disponibilidad de la unidad
- La carga por Excel no reemplaza unidades existentes, solo agrega nuevas
