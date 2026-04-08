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
  - `routes/` → lógica por recurso (un archivo por entidad)
  - `utils/` → helpers reutilizables (auth, response)
- Límite de tamaño: cada archivo en `routes/` no debe superar ~200 líneas. Si se supera, es señal de que mezcla responsabilidades y hay que dividirlo en sub-recursos

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
| `jam-auth` | `/auth/*`, `/admin/inmobiliarias/*` |
| `jam-proyectos` | `/proyectos/*`, `/admin/proyectos/*` |
| `jam-captacion` | `/clientes/*` |
| `jam-bloqueos` | `/bloqueos/*` |
| `jam-crm` | `/crm/*`, `/notificaciones/*` |
| `jam-reportes` | `/analytics/*`, `/reportes/*` |

### Estructura de routes/ por Lambda

```
lambdas/jam-auth/
├── handler.py
└── routes/
    ├── auth.py              # login, me
    ├── inmobiliarias.py     # CRUD inmobiliaria
    └── usuarios.py          # CRUD usuarios de inmobiliaria

lambdas/jam-proyectos/
├── handler.py
└── routes/
    ├── proyectos.py         # CRUD proyectos
    ├── etapas.py            # CRUD etapas
    ├── torres.py            # CRUD torres
    └── unidades.py          # CRUD unidades

lambdas/jam-bloqueos/
├── handler.py
└── routes/
    ├── bloqueos.py          # crear, liberar, extender
    └── historial.py         # consulta de historial

lambdas/jam-captacion/
├── handler.py
└── routes/
    ├── clientes.py          # registro, consulta, exclusividad
    └── estatus.py           # cambios de estatus comercial

lambdas/jam-crm/
├── handler.py
└── routes/
    └── notificaciones.py    # despacho de emails y WhatsApp
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

## Buenas prácticas de acceso a datos

### Filtrado por rol: siempre en el backend
El filtrado de datos sensibles debe ocurrir en la Lambda, nunca en el frontend.
Aunque el frontend no muestre ciertos datos, si los recibe en la respuesta son visibles en el network tab del navegador.

Ejemplo aplicado:
- `GET /proyectos` → la Lambda lee `usuario.proyectos[]` del token y solo devuelve los asignados a esa inmobiliaria
- `GET /proyectos/{id}/unidades` → la Lambda filtra campos sensibles (`cliente_id`, `bloqueado_por`) según el rol antes de responder

### Scan vs Query en DynamoDB
DynamoDB cobra por KB leído, no por filas devueltas. Un `Scan` lee toda la tabla aunque solo necesites 5 registros.

| Operación | Cuándo usar | Costo |
|-----------|-------------|-------|
| `Query` | Siempre que tengas `pk` conocido | Lee solo lo necesario |
| `Scan` | Evitar en producción con tablas grandes | Lee toda la tabla |
| `Scan` con `FilterExpression` | No reduce el costo — filtra después de leer todo | Lee toda la tabla igual |

Esto aplica igual para admin que para inmobiliaria. El rol no cambia el costo de la operación en DynamoDB.

### GSI (Global Secondary Index)
Un GSI es una tabla secundaria que DynamoDB mantiene automáticamente. Permite hacer `Query` eficientes sobre atributos que no son el pk/sk de la tabla principal.

Patrón usado en este proyecto: campo `tipo` como pk del GSI.

```python
# Sin GSI → Scan de toda la tabla
table.scan(FilterExpression='sk = METADATA')  # Lee TODOS los items

# Con GSI → Query directo
table.query(IndexName='gsi-tipo', KeyConditionExpression=Key('tipo').eq('PROYECTO'))
# Lee SOLO los proyectos
```

GSIs definidos:

| Tabla | GSI | pk | sk | Uso |
|-------|-----|----|----|-----|
| `jam-inventario` | `gsi-tipo` | `tipo` | `creado_en` | Listar proyectos |
| `jam-inventario` | `gsi-estado` | `estado` | `fecha_bloqueo` | Unidades por estado |
| `jam-inventario` | `gsi-torre` | `torre_id` | `sk` | Unidades por torre |
| `jam-usuarios` | `gsi-tipo` | `tipo` | `creado_en` | Listar inmobiliarias |
| `jam-usuarios` | `gsi-por-inmobiliaria` | `inmobiliaria_id` | `pk` | Usuarios por inmobiliaria |

Valores del campo `tipo` por entidad:

| Entidad | tipo |
|---------|------|
| Proyecto | `PROYECTO` |
| Inmobiliaria | `INMOBILIARIA` |
| Usuario | `USUARIO` |

### Paginación
Para listas que pueden crecer (unidades, clientes), implementar paginación con `Limit` + `ExclusiveStartKey` en DynamoDB y devolver `nextToken` al frontend.

---

## Infraestructura desplegada

| Recurso | Nombre / ID |
|---------|-------------|
| Cognito User Pool | `jam-user-pool` |
| API Gateway | `jam-api` |
| DynamoDB | `jam-usuarios` |
| S3 Frontend | `jam-frontend-479324457361` |
| Stack CDK | `JamConstrucciones` |
