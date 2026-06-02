# M-Connect Frontend Guide

## API Contract

La API oficial se encuentra en:

./docu_api_mconnect.json

Toda implementación de frontend debe respetar esta especificación.

## Autenticación

Endpoints:

POST /auth/login
POST /auth/refresh
POST /auth/register

Los access tokens expiran en 30 minutos.

El frontend debe:

- Guardar access_token
- Guardar refresh_token
- Renovar automáticamente cuando el access expire

## Usuario

GET /users/me
PUT /users/me
POST /users/me/change-password

## Integraciones

GET /integrations
POST /integrations
GET /integrations/{id}
PATCH /integrations/{id}
DELETE /integrations/{id}

## Monitoreo

GET /executions
GET /executions/{trace_id}
GET /executions/{trace_id}/logs

## Roles

VIEWER
OPERATOR
ADMIN

## Convenciones

- React
- TypeScript
- Tailwind
- React Query
- Axios
- Componentes reutilizables