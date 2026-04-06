# JAM Construcciones - Configuración Base

## Stack Tecnológico

### Frontend
- React + Vite
- UI: Ant Design
- Hosting: S3 + CloudFront
- Auth: AWS Cognito (Amplify)

### Backend
- Runtime: Python (Lambda)
- IaC: CDK Typescript
- API: API Gateway REST
- Auth: Cognito Authorizer
- Patrón: Lambda por dominio (monolambda con router interno)

### Mensajería / Eventos
- SQS: colas de procesamiento asíncrono
- EventBridge: bus de eventos entre servicios

### Base de Datos
- DynamoDB: tablas NoSQL por dominio

---

## Estructura del Repositorio

```
/
├── front/          # React + Vite
├── infra/          # CDK Typescript
└── docs/           # Documentación del proyecto
```

---

## Lambdas por dominio

En lugar de una lambda por endpoint, se usa una lambda por dominio de negocio.
El routing interno se maneja con `aws-lambda-powertools` Router (Python).

| Lambda | Rutas que maneja |
|--------|-----------------|
| `jam-auth` | `/auth/*` |
| `jam-proyectos` | `/proyectos/*`, `/admin/proyectos/*` |
| `jam-captacion` | `/clientes/*` |
| `jam-bloqueos` | `/bloqueos/*` |
| `jam-crm` | `/crm/*`, `/notificaciones/*` |
| `jam-reportes` | `/analytics/*`, `/reportes/*` |

---

## Convenciones

- Lambdas: `jam-<dominio>` (ej: `jam-bloqueos`, `jam-captacion`)
- Tablas DynamoDB: `jam-<entidad>` (ej: `jam-inventario`, `jam-usuarios`)
- Colas SQS: `jam-<evento>-queue` (ej: `jam-notificaciones-queue`)
- Eventos EventBridge: `jam.<dominio>.<accion>` (ej: `jam.bloqueos.liberado`)
- Stage por defecto: `dev`, `prod`

---

## Seguridad
- Cognito User Pool por ambiente
- API Gateway con Cognito Authorizer en todos los endpoints privados
- IAM roles mínimos por Lambda (least privilege)

---

## Ambientes
| Ambiente | Stage | Descripción |
|----------|-------|-------------|
| Dev | dev | Despliegue de desarrollo en AWS |
| Prod | prod | Producción |
