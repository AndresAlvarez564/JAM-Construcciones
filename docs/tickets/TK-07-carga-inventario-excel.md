# TK-07 - Carga masiva de inventario desde Excel

## Objetivo

Permitir la carga masiva de unidades desde archivos Excel para el registro inicial
y futuras actualizaciones del inventario.

---

## Alcance

### Backend (`jam-proyectos`)
- Endpoint para obtener URL prefirmada de S3 (upload directo desde el frontend)
- Lambda disparada por evento S3 al subir el archivo
- Validación de estructura y contenido del Excel
- Carga de unidades en DynamoDB respetando proyecto, etapa, torre y orden
- Respuesta de resultado: unidades cargadas, filas con error

### Frontend (React + Vite)
- Componente de carga de archivo (drag & drop o selector)
- Solo visible para admin
- Indicador de progreso y resultado de la importación
- Tabla de errores si hay filas inválidas

---

## Flujo de carga

```
Admin sube archivo Excel
        ↓
Frontend solicita URL prefirmada → GET /admin/inventario/upload-url
        ↓
Frontend sube el archivo directo a S3 (sin pasar por Lambda)
        ↓
S3 dispara evento → Lambda jam-proyectos (handler: procesar_excel)
        ↓
Validar estructura del archivo
        ↓
¿Errores críticos? → Sí → Guardar reporte de error en S3, notificar
        ↓ No
Procesar fila por fila
        ├→ Fila válida → Escribir unidad en DynamoDB (solo si no existe)
        └→ Fila inválida → Agregar a reporte de errores
        ↓
Guardar reporte final en S3
Notificar a admin con resumen (unidades cargadas / errores)
```

---

## Formato esperado del Excel

| Columna | Requerido | Descripción |
|---------|-----------|-------------|
| proyecto | Sí | Nombre o ID del proyecto |
| etapa | Sí | Nombre de la etapa |
| torre | Sí | Nombre del bloque (ej: Torre A) |
| id_unidad | Sí | Identificador legible (ej: A-101) |
| metraje | Sí | Número en m² |
| precio | Sí | Valor numérico |
| estado | No | Default: `disponible` |

- El sistema ordena las torres automáticamente por orden alfabético (A, B, C...)
- Si `id_unidad` ya existe en el proyecto, la fila se omite (no sobreescribe)
- Filas con campos requeridos vacíos se reportan como error

---

## Validaciones

| Validación | Comportamiento |
|------------|---------------|
| Archivo no es .xlsx | Rechazar antes de subir a S3 |
| Columnas requeridas faltantes | Error crítico, no procesar |
| Fila con campos vacíos | Reportar fila, continuar con las demás |
| `id_unidad` duplicado en el proyecto | Omitir fila, no sobreescribir |
| Precio o metraje no numérico | Reportar fila, continuar |

---

## Reporte de resultado

Guardado en S3 como JSON, accesible por el admin:

```json
{
  "archivo": "inventario-torre-a.xlsx",
  "total_filas": 120,
  "cargadas": 115,
  "omitidas": 3,
  "errores": 2,
  "detalle_errores": [
    { "fila": 14, "motivo": "Precio no numérico" },
    { "fila": 37, "motivo": "id_unidad vacío" }
  ]
}
```

---

## Infraestructura

- S3 bucket: `jam-archivos-{stage}` con prefijo `inventario/uploads/`
- URL prefirmada con expiración de 5 minutos
- Lambda con layer de `openpyxl` para procesar Excel en Python
- Timeout de Lambda: 5 minutos (archivos grandes)

---

## Endpoints

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/admin/inventario/upload-url` | admin | Obtener URL prefirmada para subir a S3 |
| `GET` | `/admin/inventario/reportes/{archivo_id}` | admin | Ver reporte de una importación |

---

## Criterios de aceptación

- [ ] El sistema acepta archivos `.xlsx` con la estructura definida
- [ ] Las unidades se cargan correctamente asociadas a proyecto, etapa y torre
- [ ] Las torres se ordenan automáticamente por orden alfabético
- [ ] Las unidades ya existentes no son sobreescritas
- [ ] Los errores por fila se reportan sin detener la carga completa
- [ ] El admin recibe un resumen claro del resultado
- [ ] El inventario queda disponible para consulta inmediatamente

---

## Notas técnicas

- Upload directo a S3 desde el frontend evita límites de tamaño en API Gateway (10MB)
- `openpyxl` como dependencia en Lambda layer para parsear Excel
- La Lambda se dispara por evento `s3:ObjectCreated` en el prefijo `inventario/uploads/`
- Depende de: TK-01 (auth), TK-02 (modelo de datos)
