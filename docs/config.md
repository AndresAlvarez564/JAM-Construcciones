# JAM Construcciones - Configuración Base

## Stack Tecnológico

### Frontend
- React 19 + Vite 6
- UI: Ant Design 5
- Routing: React Router DOM 7
- Auth + API: AWS Amplify v6 (`aws-amplify/auth`, `aws-amplify/api`)
- HTTP: Amplify REST API client (sin axios)
- Hosting: S3 + CloudFront

### Backend
- Runtime: Python 3.12 (Lambda)
- IaC: CDK Typescript v2 (un solo stack)
- API: API Gateway REST
- Auth: Cognito Authorizer (valida ID token)
- Patrón: Lambda por dominio, múltiples archivos por Lambda
  - `handler.py` → solo enruta
  - `routes/` → lógica por recurso
  - `utils/` → helpers reutilizables (auth, response)

### Autenticación
- Amazon Cognito User Pool
- Grupos: `admin`, `inmobiliaria`
- Auth flow: `USER_PASSWORD_AUTH`
- Token usado en API: ID token (no access token)
- Amplify configurado con `loginWith: { username: true }`

### Mensajería / Eventos
- SQS: colas de procesamiento asíncrono
- EventBridge Scheduler: tareas programadas one-time

### Base de Datos
- DynamoDB: Single Table Design por dominio
- Billing: PAY_PER_REQUEST

---

## Estructura del Repositorio

```
/
├── front/              # React + Vite
│   └── src/
│       ├── config/     # Amplify + variables de entorno
│       ├── context/    # AuthContext global
│       ├── hooks/      # useAuth
│       ├── services/   # api.ts (Amplify REST), auth.service.ts
│       ├── components/ # layout (Navbar, Sidebar, AppLayout), common
│       ├── pages/      # una carpeta por módulo
│       └── types/      # interfaces TypeScript
├── infra/              # CDK Typescript
│   └── lib/
│       └── jam-stack.ts
├── lambdas/            # Lambdas Python por dominio
│   └── jam-auth/
└── docs/               # Documentación del proyecto
```

---

## Lambdas por dominio

| Lambda | Rutas |
|--------|-------|
| `jam-auth` | `/auth/*` |
| `jam-proyectos` | `/proyectos/*`, `/admin/proyectos/*` |
| `jam-captacion` | `/clientes/*` |
| `jam-bloqueos` | `/bloqueos/*` |
| `jam-crm` | `/crm/*`, `/notificaciones/*` |
| `jam-reportes` | `/analytics/*`, `/reportes/*` |

---

## Variables de entorno (frontend)

Archivo: `front/.env` (no se commitea, usar `front/.env.example` como plantilla)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del API Gateway |
| `VITE_COGNITO_USER_POOL_ID` | ID del User Pool |
| `VITE_COGNITO_CLIENT_ID` | ID del App Client |
| `VITE_AWS_REGION` | Región AWS |
| `VITE_STAGE` | Ambiente actual |

---

## Convenciones

- Lambdas: `jam-<dominio>` (ej: `jam-bloqueos`)
- Tablas DynamoDB: `jam-<entidad>` (ej: `jam-inventario`, `jam-usuarios`)
- Colas SQS: `jam-<evento>-queue` (ej: `jam-notificaciones-queue`)
- Eventos EventBridge: `jam.<dominio>.<accion>` (ej: `jam.bloqueos.liberado`)

---

## Seguridad
- Cognito User Pool sin auto-registro (`selfSignUpEnabled: false`)
- API Gateway con Cognito Authorizer en todos los endpoints privados
- IAM roles mínimos por Lambda (least privilege)
- Todos los recursos en `RETAIN` para no perder datos en re-deploys

---

## Infraestructura desplegada

| Recurso | Nombre / ID |
|---------|-------------|
| Cognito User Pool | `jam-user-pool` |
| API Gateway | `jam-api` |
| DynamoDB | `jam-usuarios` |
| S3 Frontend | `jam-frontend-479324457361` |
| Stack CDK | `JamConstrucciones` |
