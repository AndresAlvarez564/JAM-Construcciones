# TK-01 - Configuración base del sistema y autenticación de usuarios

## Objetivo

Preparar la base técnica del sistema y habilitar el acceso autenticado para administración
e inmobiliarias, garantizando control de acceso desde el inicio.

---

## Arquitectura

```
Admin JAM / Corredores / Inmobiliarias
            ↓
        CloudFront
            ↓
      S3 - Frontend (React + Vite)
         ↓           ↓
   Amazon Cognito   API Gateway REST
   User Pool        + Cognito Authorizer (ID token)
                        ↓
                  Lambda jam-auth (Python)
                        ↓
                    DynamoDB jam-usuarios
```

---

## Lo implementado

### Infraestructura (CDK)
- Cognito User Pool `jam-user-pool` con grupos `admin` e `inmobiliaria`
- App Client con `USER_PASSWORD_AUTH` y `USER_SRP_AUTH`
- API Gateway REST `jam-api` con Cognito Authorizer
- Gateway Responses con headers CORS para errores 4XX y 5XX
- Lambda `jam-auth` con permisos mínimos (least privilege)
- Tabla DynamoDB `jam-usuarios` (Single Table Design)
- GSI `gsi-por-inmobiliaria` para listar usuarios por inmobiliaria
- S3 + CloudFront para el frontend

### Backend (Lambda Python)
- `POST /auth/login` → público, llama a Cognito `InitiateAuth`
- `GET /auth/me` → protegido, retorna perfil + rol + proyectos desde DynamoDB
- El rol se lee desde DynamoDB, los grupos de Cognito son la fuente de verdad de acceso

### Frontend (React + Vite)
- Amplify v6 configurado con Cognito (`USER_PASSWORD_AUTH`, `loginWith: username`)
- Amplify REST API client para todas las llamadas al API Gateway
- Token usado: ID token (no access token) — requerido por Cognito Authorizer
- `signOut` antes de `signIn` para evitar `UserAlreadyAuthenticatedException`
- `AuthContext` con estado global del usuario (rol, proyectos, nombre)
- `useAuth` hook para consumir el contexto
- `ProtectedRoute` con validación de rol
- Login page con Ant Design
- Página `/unauthorized` para accesos denegados
- Layout responsive: sidebar fijo en desktop, drawer en móvil
- Navbar con hamburguesa en móvil

---

## Modelo de datos

### Tabla: `jam-usuarios`

| pk | sk | tipo | atributos |
|----|----|------|-----------|
| `INMOBILIARIA#<id>` | `METADATA` | inmobiliaria | `nombre`, `correos[]`, `proyectos[]`, `activo` |
| `USUARIO#<cognito_sub>` | `METADATA` | usuario | `nombre`, `rol`, `inmobiliaria_id`, `activo` |

GSI: `gsi-por-inmobiliaria` → pk: `inmobiliaria_id`, sk: `pk`

---

## Lógica de acceso

- `admin`: acceso total, ve todos los proyectos y datos
- `inmobiliaria`: acceso solo a proyectos asignados en su registro de DynamoDB
- Nombre de usuario: alias (ej: "Vendedor1", "Usuario"), no correo
- Deshabilitar: `activo = false` en DynamoDB + deshabilitar en Cognito (historial preservado)
- Múltiples correos por inmobiliaria: campo `correos[]` en `INMOBILIARIA#METADATA`

---

## Gestión de inmobiliarias

### Crear inmobiliaria
1. Admin crea registro en DynamoDB: `INMOBILIARIA#<id>` con `nombre`, `correos[]`, `proyectos[]`, `activo: true`
2. Admin crea usuario en Cognito con nombre de usuario tipo alias (ej: "VendedorXYZ")
3. Admin asigna el usuario al grupo `inmobiliaria` en Cognito
4. Admin vincula el `cognito_sub` al registro de la inmobiliaria en DynamoDB

### Deshabilitar inmobiliaria
- `activo = false` en DynamoDB → bloquea acceso lógico
- Deshabilitar usuario en Cognito → bloquea autenticación
- Historial, clientes y bloqueos se conservan íntegros

---

## Criterios de aceptación

- [x] Login funcional para ambos roles
- [x] Rutas protegidas no accesibles sin token válido
- [x] El sistema diferencia correctamente `admin` e `inmobiliaria`
- [x] Token expirado redirige al login automáticamente
- [x] Layout responsive (desktop y móvil)
- [x] Base técnica lista para continuar con TK-02 y TK-03
- [ ] Admin puede crear inmobiliarias con múltiples correos de notificación
- [ ] Admin puede crear usuarios con nombre alias (no correo)
- [ ] Admin puede deshabilitar una inmobiliaria sin perder su historial
- [ ] Inmobiliarias solo ven los proyectos que les fueron asignados explícitamente

---

## Notas técnicas

- El Cognito Authorizer valida el ID token, no el access token
- Amplify v6 usa `session.tokens.idToken` para el header `Authorization`
- Un solo stack CDK sin sufijo de stage (`JamConstrucciones`)
- Todos los recursos con `RemovalPolicy.RETAIN` para proteger datos en producción
