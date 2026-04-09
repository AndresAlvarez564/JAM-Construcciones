# Informe de Cambios — Frontend: Módulo de Inventario

**Fecha:** 09 de abril de 2026
**Área:** Frontend — Módulo de Inventario / Unidades
**Base:** Desde commit `tk2 reunion`

---

## Resumen

Se realizaron mejoras en la navegación y usabilidad del módulo de inventario, principalmente en la forma en que se visualizan y crean unidades. Adicionalmente se agregaron páginas de "en construcción" para módulos pendientes.

---

## Cambios realizados

### 1. Vista de unidades por proyecto (nueva vista predeterminada)

Anteriormente al seleccionar un proyecto, el flujo era:

> Proyectos → Edificios → Unidades

Ahora la vista predeterminada al entrar a un proyecto es:

> Proyectos → Todas las unidades del proyecto

Esta vista muestra todas las unidades sin importar el edificio, con una columna adicional **"Edificio"** para identificar a cuál pertenece cada unidad.

Desde esta vista se puede acceder a la navegación por edificio mediante el botón **"Ver por edificio"** ubicado en el encabezado, manteniendo el flujo anterior como opción secundaria.

### 2. Formulario de creación de unidad adaptado por contexto

- Cuando se crea una unidad desde la vista **"todas las unidades"**, el formulario incluye un campo selector de **Edificio**, ya que no hay uno preseleccionado.
- Al seleccionar el edificio, la etapa se asigna automáticamente.
- Cuando se crea desde la vista **por edificio**, el campo de edificio permanece oculto y pre-seteado como antes.

### 3. Páginas en construcción

Se creó un componente reutilizable `UnderConstruction` y se aplicó a los módulos que aún no tienen implementación:

- **Dashboard** — muestra pantalla de en construcción
- **Clientes** — muestra pantalla de en construcción
- **Reportes** — página nueva, ruta `/reportes` registrada, muestra pantalla de en construcción

---

## Archivos modificados

| Archivo | Tipo |
|---|---|
| `front/src/pages/inventario/InventarioPage.tsx` | Modificado |
| `front/src/pages/dashboard/DashboardPage.tsx` | Modificado |
| `front/src/pages/clientes/ClientesPage.tsx` | Modificado |
| `front/src/pages/reportes/ReportesPage.tsx` | Nuevo |
| `front/src/components/common/UnderConstruction.tsx` | Nuevo |
| `front/src/App.tsx` | Modificado (ruta `/reportes`) |

---

## Notas

- No se realizaron cambios en backend ni infraestructura.
- Los cambios son compatibles con todos los roles existentes (`admin`, `coordinador`, `supervisor`, `inmobiliaria`).
