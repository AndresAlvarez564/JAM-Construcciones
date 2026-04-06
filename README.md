# JAM Construcciones - Sistema de Gestión Comercial

Sistema web para gestión de inventario, bloqueos y captación de clientes para proyectos inmobiliarios.

## Stack

- Frontend: React + Vite + Ant Design, hospedado en S3 + CloudFront
- Auth: Amazon Cognito + Amplify
- Backend: Python Lambda + API Gateway REST
- Base de datos: DynamoDB
- Mensajería: SQS + EventBridge
- IaC: CDK Typescript

## Estructura del repositorio

```
/
├── front/      # React + Vite
├── infra/      # CDK Typescript
└── docs/       # Documentación
    ├── Config.md
    ├── requerimientos-funcionales.md
    └── tickets/
```

## Ambientes

| Stage | Descripción |
|-------|-------------|
| `dev` | Desarrollo en AWS |
| `prod` | Producción |

## Documentación

- [Configuración base](docs/Config.md)
- [Requerimientos funcionales](docs/requerimientos-funcionales.md)

## Tickets

| ID | Título | Fase |
|----|--------|------|
| [TK-01](docs/tickets/TK-01-autenticacion-base.md) | Configuración base y autenticación | 1 |
| [TK-02](docs/tickets/TK-02-modelo-datos-base.md) | Modelo de datos base | 1 |
| [TK-03](docs/tickets/TK-03-visualizacion-inventario.md) | Visualización de inventario con filtros | 2 |
| [TK-04](docs/tickets/TK-04-bloqueo-unidades.md) | Bloqueo de unidades y control de concurrencia | 2 |
| [TK-05](docs/tickets/TK-05-captacion-clientes.md) | Captación de clientes y exclusividad | 2 |
| [TK-06](docs/tickets/TK-06-estatus-comerciales-kommo.md) | Estatus comerciales e integración Kommo | 2 |
| [TK-07](docs/tickets/TK-07-carga-inventario-excel.md) | Carga masiva de inventario desde Excel | 2 |
| [TK-08](docs/tickets/TK-08-notificaciones-trazabilidad.md) | Notificaciones y trazabilidad | 2 |
| [TK-09](docs/tickets/TK-09-qa-estabilizacion.md) | QA funcional y estabilización | 3 |
| [TK-10](docs/tickets/TK-10-despliegue-produccion.md) | Despliegue a producción | 3 |
