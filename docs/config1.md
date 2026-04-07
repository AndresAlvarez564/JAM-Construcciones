# Stack Config — React + Cognito + API Gateway + Lambda + DynamoDB

Stack serverless genérico con React en el frontend, autenticación con Cognito, API REST con API Gateway + Lambda (Python), y DynamoDB como base de datos.

---

## Stack Tecnológico

### Frontend
- React + Vite
- UI: Ant Design 5
- Routing: React Router DOM
- Auth + API: AWS Amplify v6 (`aws-amplify/auth`, `aws-amplify/api`)
- HTTP: Amplify REST API client (sin axios)
- Hosting: S3 + CloudFront

### Backend
- Runtime: Python 3.12 (Lambda)
- IaC: CDK TypeScript v2 (un solo stack)
- API: API Gateway REST
- Auth: Cognito Authorizer (valida ID token)

### Patrón Lambda por dominio

Cada dominio tiene su propia Lambda con esta estructura interna:

```
lambdas/<nombre>/
├── handler.py      # solo enruta al módulo correcto
├── routes/         # lógica por recurso
└── utils/          # helpers reutilizables (auth, response)
```

### Autenticación
- Amazon Cognito User Pool
- Auth flow: `USER_PASSWORD_AUTH`
- Token usado en API: ID token (no access token)
- Amplify configurado con `loginWith: { username: true }`
- Sin auto-registro (`selfSignUpEnabled: false`)
- Grupos de acceso definidos por proyecto (ej: `admin`, `viewer`)

### Base de Datos
- DynamoDB: Single Table Design por dominio
- Billing: `PAY_PER_REQUEST`

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
│       ├── components/ # layout y common
│       ├── pages/      # una carpeta por módulo
│       └── types/      # interfaces TypeScript
├── infra/              # CDK TypeScript
│   └── lib/
│       └── <proyecto>-stack.ts
├── lambdas/            # Lambdas Python por dominio
└── docs/               # Documentación del proyecto
```

---

## Variables de entorno (frontend)

Archivo: `front/.env` (no se commitea, usar `front/.env.example` como plantilla)

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del API Gateway |
| `VITE_COGNITO_USER_POOL_ID` | ID del User Pool |
| `VITE_COGNITO_CLIENT_ID` | ID del App Client |
| `VITE_AWS_REGION` | Región AWS |
| `VITE_STAGE` | Ambiente actual (`dev`, `prod`) |

---

## Convenciones de nombres

Reemplaza `<proyecto>` con el prefijo corto de tu proyecto (ej: `jam`, `crm`, `ops`).

| Recurso | Patrón | Ejemplo |
|---------|--------|---------|
| Lambda | `<proyecto>-<dominio>` | `jam-auth` |
| Tabla DynamoDB | `<proyecto>-<entidad>` | `jam-usuarios` |
| Cognito User Pool | `<proyecto>-user-pool` | `jam-user-pool` |
| API Gateway | `<proyecto>-api` | `jam-api` |
| S3 Frontend | `<proyecto>-frontend-<account_id>` | `jam-frontend-123456789` |
| Stack CDK | PascalCase del proyecto | `JamConstrucciones` |

---

## Seguridad
- API Gateway con Cognito Authorizer en todos los endpoints privados
- IAM roles mínimos por Lambda (least privilege)
- Todos los recursos en `RETAIN` para no perder datos en re-deploys

---

## Infraestructura base (CDK)

Recursos mínimos que define el stack:

- Cognito User Pool + App Client
- API Gateway REST + Cognito Authorizer
- Lambda(s) por dominio con sus permisos
- DynamoDB table(s) por entidad
- S3 bucket + CloudFront distribution para el frontend
