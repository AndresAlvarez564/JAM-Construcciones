# TK-03 - Visualización de inventario con filtros y mejoras frontend

## Objetivo

Panel principal de inventario para que administración e inmobiliarias consulten
unidades de forma rápida, clara y con información controlada por rol.
Incluye mejoras visuales, filtros en cascada y experiencia de usuario optimizada.

---

## Alcance

### Backend (`jam-proyectos`)
- ✅ Endpoint `GET /proyectos/{id}/unidades` con soporte de query params para filtros
- ✅ Filtros disponibles: `etapa_id`, `torre_id`, `estado`
- ✅ La respuesta varía según el rol del token (admin vs inmobiliaria)
- ✅ Inmobiliaria NO ve: `cliente_id`, `bloqueado_por`
- ⬜ Inmobiliaria tampoco debe ver: `fecha_bloqueo`, `fecha_liberacion` (ajuste pendiente)

> El campo `tiempo_restante` y la lógica de bloqueo se implementan en TK-04.
> TK-03 solo consume esos datos una vez que TK-04 los provea.

### Frontend (React + Vite)
- ✅ Navegación proyecto → edificio → unidades con breadcrumb
- ✅ Filtro por estado
- ✅ Inmobiliarias solo ven proyectos asignados
- ✅ Tabla de unidades con columnas base (ID, metraje, precio, estado)
- ✅ Columna de edificio visible en vista "todas las unidades del proyecto"
- ⬜ Filtros en cascada: etapa → torre
- ⬜ Colores de estado diferenciados para todos los estados (solo verde está implementado)
- ⬜ Columna de etapa visible en la tabla
- ⬜ Columnas admin: `bloqueado_por`, `fecha_bloqueo` (visibles solo para admin)
- ⬜ Mejoras visuales: colores de fila por estado, cards con resumen de unidades
- ⬜ Responsive mejorado

---

## Visibilidad por rol

| Campo | Admin | Inmobiliaria |
|-------|-------|--------------|
| ID unidad | ✔ | ✔ |
| Torre / Etapa | ✔ | ✔ |
| Metraje | ✔ | ✔ |
| Precio | ✔ | ✔ |
| Estado | ✔ | ✔ |
| Tiempo restante (bloqueo) | ✔ (TK-04) | ✔ (TK-04) |
| Cliente asociado | ✔ | ✗ |
| Inmobiliaria que bloqueó | ✔ | ✗ |
| Fecha de bloqueo | ✔ | ✗ |

> La lógica de visibilidad se aplica en el backend según el grupo Cognito del token.

---

## Filtros

| Filtro | Estado | Descripción |
|--------|--------|-------------|
| Proyecto | ✅ | Lista de proyectos asignados al usuario |
| Etapa | ⬜ | Etapas del proyecto seleccionado (carga al elegir proyecto) |
| Torre | ✅ | Torres del proyecto (falta filtrar por etapa seleccionada) |
| Estado | ✅ | disponible, bloqueada, no_disponible, vendida, desvinculada |

- ⬜ Los filtros de etapa y torre deben cargar en cascada (etapa primero, luego torre filtrada por etapa)

---

## Estados y visualización

| Estado | Color | Estado impl. |
|--------|-------|--------------|
| `disponible` | Verde | ✅ |
| `bloqueada` | Amarillo | ⬜ |
| `no_disponible` | Naranja | ⬜ |
| `vendida` | Gris | ⬜ |
| `desvinculada` | Rojo claro | ⬜ |

---

## Timer de bloqueo (depende de TK-04)

> Esta sección se completa una vez que TK-04 provea `fecha_liberacion` y `tiempo_restante` en el response.

- ⬜ Se muestra solo cuando `estado = bloqueada`
- ⬜ Countdown en tiempo real calculado desde `fecha_liberacion`
- ⬜ Al llegar a 0 la unidad cambia visualmente a `disponible` sin recargar
- ⬜ A las 5h o menos antes de vencer: resaltar visualmente el timer (color rojo)

---

## Mejoras visuales frontend (pendientes)

- ⬜ Colores de fila en tabla según estado de la unidad
- ⬜ Cards de proyecto con resumen de unidades por estado
- ⬜ Columna de etapa en la tabla de unidades
- ⬜ Columnas admin (`bloqueado_por`, `fecha_bloqueo`) visibles solo para admin
- ⬜ Mensaje de vacío con contexto (ej: "No hay unidades disponibles en esta torre")

---

## Endpoint

```
GET /proyectos/{proyecto_id}/unidades
  ?etapa_id=<etapa_id>
  &torre_id=<torre_id>
  &estado=disponible,bloqueada
```

Respuesta admin incluye: `cliente_id`, `bloqueado_por`, `fecha_bloqueo`, `fecha_liberacion`
Respuesta inmobiliaria excluye esos campos

---

## Criterios de aceptación

- ✅ El usuario puede filtrar unidades por proyecto, torre y estado
- ✅ Las inmobiliarias no ven `cliente_id` ni `bloqueado_por`
- ✅ Admin ve todos los campos incluyendo cliente e inmobiliaria bloqueadora
- ✅ Inmobiliarias solo ven proyectos que tienen asignados
- ⬜ Filtro por etapa con cascada etapa → torre
- ⬜ Cada estado tiene un color visual diferenciado
- ⬜ La columna de etapa es visible en la tabla
- ⬜ Las columnas admin (`bloqueado_por`, `fecha_bloqueo`) solo aparecen para admin
- ⬜ Inmobiliaria no ve `fecha_bloqueo` ni `fecha_liberacion` (ajuste backend)
- ⬜ La vista es usable en desktop y móvil (mejoras responsive)
- ⬜ Timer de bloqueo en tiempo real (completar tras TK-04)

---

## Notas técnicas

- El backend filtra los campos de respuesta según el grupo Cognito del token
- Paginación recomendada si el proyecto supera 200 unidades visibles
- El timer corre en el cliente, no requiere polling al backend (implementar tras TK-04)
- Depende de: TK-01 (auth), TK-02 (modelo de datos)
- Timer y campos de bloqueo se integran visualmente una vez completado TK-04
