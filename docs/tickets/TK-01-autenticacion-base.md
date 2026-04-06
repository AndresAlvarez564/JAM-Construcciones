# TK-01 - Configuración base del sistema y autenticación de usuarios

## Objetivo

Preparar la base técnica del sistema y habilitar el acceso autenticado para administración
e inmobiliarias, garantizando control de acceso desde el inicio.

---

## Arquitectura del ticket

```
Admin JAM / Corredores / Inmobiliarias
            ↓
        CloudFront
            ↓
      S3 - Frontend Web (React + Vite)
         ↓           ↓
   Amazon Cognito   API Gateway REST API
                        ↓
                  Lambda API Core (Python)
                        ↓
                    DynamoDB
```

---

## Alcance

### Infraestructura (CDK)
- Cognito User Pool con dos grupos: `admin` y `inmobiliaria`
- API Gateway REST con Cognito Authorizer
- Lambda base para validación de sesión y permisos
- Tabla DynamoDB `jam-usuarios` e `jam-inmobiliarias`
- S3 + CloudFront para el frontend

### Backend (Lambda Python)
- Endpoint `POST /auth/login` → flujo de autenticación con Cognito
- Endpoint `GET /auth/me` → retorna perfil y permisos del usuario autenticado
- Middleware de autorización: valida grupo Cognito en cada request protegido
- Lógica de permisos por proyecto (base para módulos siguientes)

### Frontend (React + Vite)
- Configuración de Amplify con Cognito (REST API, no Hosted UI)
- Pantalla de login
- Protección de rutas por rol (`admin` / `inmobiliaria`)
- Redirección automática si sesión inactiva o token expirado
- Contexto global de usuario (rol, proyectos asignados)

---

## Modelo de datos

### Tabla: `jam-inmobiliarias`
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `INMOBILIARIA#<id>` |
| sk | String | `METADATA` |
| nombre | String | Nombre de la inmobiliaria |
| correos | List | Lista de correos para notificaciones |
| proyectos | List | IDs de proyectos asignados |
| activo | Boolean | Acceso habilitado / deshabilitado |
| creado_en | String | ISO timestamp |

### Tabla: `jam-usuarios`
| Atributo | Tipo | Descripción |
|----------|------|-------------|
| pk | String | `USUARIO#<cognito_sub>` |
| sk | String | `METADATA` |
| nombre | String | Nombre de usuario (no correo) |
| rol | String | `admin` / `inmobiliaria` |
| inmobiliaria_id | String | Referencia si rol = inmobiliaria |
| activo | Boolean | Estado del acceso |

---

## Lógica de acceso

- Usuario `admin`: acceso total, ve todos los proyectos y datos
- Usuario `inmobiliaria`: acceso solo a proyectos asignados en `jam-inmobiliarias`
- El nombre de usuario para inmobiliarias es un alias (ej: "Vendedor1"), no un correo
- Deshabilitar inmobiliaria: `activo = false` en DynamoDB + deshabilitar usuario en Cognito, sin borrar historial

---

## Criterios de aceptación

- [ ] Login funcional para ambos roles
- [ ] Rutas protegidas no accesibles sin token válido
- [ ] El sistema diferencia correctamente `admin` e `inmobiliaria`
- [ ] Token expirado redirige al login automáticamente
- [ ] Admin puede ver todos los proyectos; inmobiliaria solo los asignados
- [ ] Base técnica lista para continuar con TK-02 y TK-03

---

## Notas técnicas

- API Gateway REST (no HTTP API) con Cognito Authorizer en todos los endpoints privados
- Amplify configurado en modo REST, no GraphQL ni Hosted UI
- Los grupos de Cognito (`admin`, `inmobiliaria`) se usan como fuente de verdad del rol
- Ambientes: `dev` y `prod`, variables de entorno por stage en CDK
