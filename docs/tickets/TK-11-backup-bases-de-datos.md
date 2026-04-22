# TK-11 - Backup de bases de datos

## Objetivo

Salvaguardar los datos del sistema ante cualquier desastre que afecte el negocio, garantizando recuperación ante fallos, eliminaciones accidentales o corrupción de datos.

---

## Alcance

- Habilitar Point-in-Time Recovery (PITR) en todas las tablas DynamoDB
- Configurar backups automáticos programados
- Documentar el proceso de restauración
- Verificar que `RemovalPolicy.RETAIN` está activo en todas las tablas

---

## Tablas a proteger

| Tabla | Datos críticos |
|-------|---------------|
| `jam-usuarios` | Usuarios, inmobiliarias, roles |
| `jam-inventario` | Proyectos, etapas, torres, unidades |
| `jam-clientes` | Perfiles de clientes y exclusividades |
| `jam-procesos` | Procesos de venta activos e históricos |
| `jam-historial-bloqueos` | Trazabilidad de bloqueos |

---

## Implementación

### PITR (Point-in-Time Recovery)
Permite restaurar cualquier tabla a cualquier punto en los últimos 35 días. Se habilita en CDK con `pointInTimeRecovery: true` en cada tabla.

### Backups automáticos
AWS Backup puede programar snapshots diarios con retención configurable (ej: 30 días).

---

## Criterios de aceptación

- [ ] PITR habilitado en todas las tablas DynamoDB
- [ ] `RemovalPolicy.RETAIN` confirmado en todas las tablas
- [ ] Proceso de restauración documentado
- [ ] Backup automático programado

---

## Notas técnicas

- PITR no tiene costo adicional significativo para el volumen de JAM
- La restauración crea una tabla nueva — hay que actualizar las variables de entorno de las lambdas si se restaura
- Depende de: infraestructura base (TK-01 al TK-10)
