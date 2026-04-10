# Informe de Cambios — Frontend y Backend: TK-03

**Fecha:** Abril 2026
**Área:** Frontend · Backend · Infraestructura
**Tickets cubiertos:** TK-03 (visualización de inventario), mejoras de layout e inmobiliarias

---

## Resumen

Se completó el TK-03 con mejoras visuales y funcionales en el módulo de inventario, rediseño del layout general de la aplicación, y mejoras en la página de inmobiliarias. Se agregó infraestructura para subida de imágenes de proyectos (S3 + CloudFront) y un nuevo endpoint de presigned URL en el backend.

---

## Cambios por área

### Layout general

- Eliminado el Navbar superior. Toda la navegación consolidada en el sidebar.
- Sidebar rediseñado: logo centrado, secciones agrupadas, item activo en azul, perfil de usuario fijo abajo, logout con hover rojo.
- Fondo general cambiado a `#f5f7fa`.
- Sidebar fijo de 250px en desktop, drawer en móvil.

### Módulo de inventario — Proyectos

- Cards rediseñadas con imagen de portada (o gradiente único por proyecto como fallback).
- Subida de imagen desde el formulario de edición, almacenada en S3 y servida por CloudFront.
- Botones de acción flotando sobre la imagen.

### Módulo de inventario — Edificios

- Edificios agrupados por etapa con separador visual y barra de color lateral.
- Cards con banda de color superior según etapa, ícono con fondo suave, hover con borde de color.
- Botón "Ver todas las unidades" agregado en la vista de edificios.
- Botones de etapas y nuevo edificio disponibles también desde la vista de todas las unidades.

### Módulo de inventario — Unidades

- Fila de estadísticas (total, disponibles, bloqueadas, vendidas) encima de la tabla.
- Filtros en cascada: etapa → torre → estado, con botón de limpiar filtros.
- Colores de fila diferenciados por estado en la tabla.
- Columnas de etapa y edificio visibles en la vista de todas las unidades.
- Columnas `Bloqueado por` y `Fecha de bloqueo` visibles solo para admin.
- Mensaje de vacío con ícono y contexto.

### Inmobiliarias

- Cards rediseñadas con banda de color, avatar con inicial, color único por inmobiliaria.
- Hover con borde del color de la inmobiliaria.
- Drawer de usuarios rediseñado: header con avatar, nombre, contador y correos.
- Lista de usuarios con avatar y acciones inline.

### Backend (`jam-proyectos`)

- Nuevo endpoint `POST /admin/proyectos/{id}/imagen` que genera presigned URL para subida directa a S3.
- `actualizar()` acepta el campo `imagen_url`.
- Tipo `Proyecto` actualizado con `imagen_url?: string`.

### Infraestructura (CDK)

- Nuevo bucket S3 `jam-assets-{account}` con CORS configurado para PUT/GET.
- Behavior adicional en CloudFront para `/assets/*` apuntando al bucket de assets.
- Permisos de lectura/escritura en S3 otorgados a la lambda `jam-proyectos`.
- Variables de entorno `ASSETS_BUCKET` y `CLOUDFRONT_URL` inyectadas en la lambda.
- Nuevo endpoint en API Gateway: `POST /admin/proyectos/{id}/imagen`.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `front/src/pages/inventario/InventarioPage.tsx` | Rediseño completo de las 3 vistas |
| `front/src/pages/inmobiliarias/InmobiliariasPage.tsx` | Rediseño de cards y drawer |
| `front/src/components/layout/Sidebar.tsx` | Rediseño completo |
| `front/src/components/layout/AppLayout.tsx` | Eliminado Navbar, sidebar fijo |
| `front/src/components/layout/Navbar.tsx` | Eliminado |
| `front/src/services/proyectos.service.ts` | `getPresignedImagenProyecto`, `actualizarProyecto` con `imagen_url` |
| `front/src/types/index.ts` | `imagen_url` en `Proyecto` |
| `front/src/index.css` | Colores de fila por estado |
| `lambdas/jam-proyectos/routes/proyectos.py` | `presigned_imagen()`, `imagen_url` en `actualizar()` |
| `lambdas/jam-proyectos/handler.py` | Ruta `/imagen` registrada |
| `infra/lib/jam-stack.ts` | Bucket assets, behavior CloudFront, endpoint imagen |

---

## Pendiente

- Timer de bloqueo en tiempo real (depende de TK-04: requiere `fecha_liberacion` en el response de unidades).
