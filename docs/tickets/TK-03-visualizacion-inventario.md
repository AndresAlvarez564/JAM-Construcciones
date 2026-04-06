# TK-03 - Visualización de inventario con filtros

## Objetivo

Panel principal de inventario para que administración e inmobiliarias consulten
unidades de forma rápida, clara y con información controlada por rol.

---

## Alcance

### Backend (`jam-proyectos`)
- Endpoint `GET /proyectos/{id}/unidades` con soporte de query params para filtros
- Filtros disponibles: `etapa`, `torre`, `estado`
- La respuesta varía según el rol del token (admin vs inmobiliaria)
- Cálculo de `tiempo_restante` en segundos desde `fecha_liberacion`

### Frontend (React + Vite)
- Vista principal de inventario con tabla/grid de unidades
- Filtros por proyecto, etapa, torre y estado
- Columnas visibles según rol
- Timer visual para unidades bloqueadas
- Responsive: desktop y móvil

---

## Visibilidad por rol

| Campo | Admin | Inmobiliaria |
|-------|-------|--------------|
| ID unidad | ✔ | ✔ |
| Torre / Etapa | ✔ | ✔ |
| Metraje | ✔ | ✔ |
| Precio | ✔ | ✔ |
| Estado | ✔ | ✔ |
| Tiempo restante (bloqueo) | ✔ | ✔ |
| Cliente asociado | ✔ | ✗ |
| Inmobiliaria que bloqueó | ✔ | ✗ |
| Fecha de bloqueo | ✔ | ✗ |

---

## Filtros

| Filtro | Tipo | Descripción |
|--------|------|-------------|
| Proyecto | Select | Lista de proyectos asignados al usuario |
| Etapa | Select | Etapas del proyecto seleccionado |
| Torre | Select | Torres de la etapa seleccionada |
| Estado | Select múltiple | disponible, bloqueada, no_disponible, vendida |

- Los filtros de etapa y torre se cargan en cascada según el proyecto seleccionado
- Inmobiliarias solo ven proyectos que tienen asignados

---

## Estados y visualización

| Estado | Color sugerido | Acción disponible |
|--------|---------------|-------------------|
| `disponible` | Verde | Bloquear (inmobiliaria) |
| `bloqueada` | Amarillo | Ver timer, extender (solo admin) |
| `no_disponible` | Naranja | Ver detalle (solo admin) |
| `vendida` | Gris | Solo lectura |
| `desvinculada` | Rojo claro | Solo lectura |

---

## Timer de bloqueo

- Se muestra solo cuando `estado = bloqueada`
- Calcula tiempo restante desde `fecha_liberacion` en tiempo real (countdown)
- Al llegar a 0 la unidad cambia visualmente a `disponible` sin recargar la página
- A las 5 horas antes de vencer se resalta visualmente (ej: color rojo en el timer)

---

## Endpoint

```
GET /proyectos/{proyecto_id}/unidades
  ?etapa=<etapa_id>
  &torre=<torre_id>
  &estado=disponible,bloqueada
```

Respuesta admin incluye: `cliente_id`, `bloqueado_por`, `fecha_bloqueo`
Respuesta inmobiliaria excluye esos campos

---

## Criterios de aceptación

- [ ] El usuario puede filtrar unidades por proyecto, etapa, torre y estado
- [ ] Las inmobiliarias no ven cliente ni inmobiliaria que bloqueó
- [ ] Admin ve todos los campos
- [ ] El timer de bloqueo se actualiza en tiempo real
- [ ] Los filtros de etapa y torre cargan en cascada
- [ ] La vista es usable en desktop y móvil

---

## Notas técnicas

- El backend filtra los campos de respuesta según el grupo Cognito del token
- Paginación recomendada si el proyecto supera 200 unidades visibles
- El timer corre en el cliente, no requiere polling al backend
- Depende de: TK-01 (auth) y TK-02 (modelo de datos)
