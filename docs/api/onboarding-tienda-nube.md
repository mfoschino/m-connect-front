# Runbook: Onboarding Tienda Nube → MConnect (entidad `sales_order`)

> Documento portable y autocontenido. Pensado para trabajarlo junto con la documentación oficial
> de la API de Tienda Nube y completar los placeholders marcados con ⚠️.

## Contexto y objetivo

Probar el pipeline de MConnect de punta a punta ingiriendo **pedidos de Tienda Nube** y
transformándolos al modelo canónico `sales_order`. **No requiere escribir código**: MConnect ya trae
un conector `"api"` genérico y todo el onboarding se hace por REST (crear MappingProfile + LookupTables
+ IntegrationConfig y disparar el pipeline).

Estrategia: **progresiva**. Primero se valida el mapeo con un payload de ejemplo vía
`/integrations/{id}/trigger` (sin depender de la API real), y recién cuando el canónico valida se hace
el pull real con `/integrations/{id}/run`.

## Arquitectura del flujo (resumen)

```
Tienda Nube (API REST)
   │  IntegrationConfig(connector_type="api", config={...})
   ▼
ingest_message ──▶ transform_message ──▶ (schema validation) ──▶ deliver_message (Finnegans)
                     │
                     usa MappingProfile(source_system="tiendanube", entity="sales_order")
                     + LookupTables referenciadas
```

Tres formas de entrada, todas soportadas: **trigger** (test con payload pegado), **run** (pull batch del
conector api, manual o por cron) y **webhook** (push en tiempo real; hidrata el aviso liviano con `fetch`).

## Ruta rápida (checklist para terminar la integración)

Orden recomendado — **no automatices hasta que un `trigger` impacte en Finnegans** (paso 4):

1. **Entorno** (Prerequisitos): stack arriba + migrado, token admin, tenant.
2. **Mapeo de entrada** Tienda Nube → canónico: LookupTable de estados (Fase 1) → MappingProfile
   `tiendanube→sales_order` (Fase 2) → IntegrationConfig `api` (Fase 3).
3. **Validar el mapeo** con un pedido real vía `trigger` (Fase 4): iterar hasta `schema_validated` OK.
4. **Entrega a Finnegans** (Fase 7): credenciales `.env` + perfil de salida `pedido_venta` + datos
   maestros. Probar un `trigger` → debe terminar en **`delivery_completed`** (impacto real). ← hito.
5. **Automatizar** (elegí una o ambas):
   - **Pull programado** + ventana incremental (Fase 6).
   - **Webhook en tiempo real** con `fetch` (Anexo).
6. Si algo se traba (mensaje "queued" que no aparece) → **Troubleshooting**.

## Modelo canónico objetivo: `sales_order` (esto es fijo, no depende de Tienda Nube)

Raíz `SalesOrder` — **requeridos: `external_id`, `customer_id`, `total`**:

| Campo | Tipo | Nota |
|---|---|---|
| `external_id` | string (**req**) | ID del pedido en Tienda Nube (clave de idempotencia) |
| `order_number` | string\|null | número visible del pedido |
| `customer_id` | string (**req**) | external_id del cliente canónico |
| `status` | string\|null | típicamente vía `lookup` |
| `currency` | string\|null | ej "ARS" |
| `lines` | array<SalesOrderLine> | líneas del pedido |
| `subtotal`,`discount_total`,`tax_total`,`shipping_total` | number\|string\|null | montos aceptan string |
| `total` | number\|string (**req**) | total del pedido |
| `shipping_address`,`billing_address` | Address\|null | objeto anidado |
| `ordered_at`,`updated_at` | date-time (ISO)\|null | |
| `metadata` | object\|null | passthrough libre |

`SalesOrderLine` — **requeridos: `product_id`, `quantity`, `unit_price`, `total`**; opcionales:
`line_number`, `sku`, `description`, `discount_amount`, `discount_percent`, `tax_rate`, `tax_amount`,
`subtotal`, `metadata`.

`Address` — todos opcionales (string\|null): `street`, `number`, `floor`, `apartment`, `city`,
`state`, `country`, `zip_code`, `full_address`.

## Tipos de mapper disponibles (para armar el `config` del profile)

Claves comunes a todos: `target_field` (req), `field_type` (req), `source_field`, `on_error`
(`fail`|`skip`|`default`), `default_value`.

| field_type | Claves propias | Uso |
|---|---|---|
| `simple` | `source_field` | copia 1:1 (campo plano) |
| `path` | `path` (dot-notation; cae a source_field) | leer campo **anidado** (ej `customer.id`) |
| `constant` | `value` | valor fijo |
| `default` | `source_field`, `default_value` | fallback si ausente/null |
| `concat` | `fields` (list), `separator` | unir campos |
| `datetime` | `source_field`, `source_format`, `target_format` | fechas (ver caveat abajo) |
| `expression` | `expression` (simpleeval) | cálculos (ej `price * quantity`) |
| `conditional` | `condition`, `true_value`, `false_value` | if/else |
| `lookup` | `source_field`, `lookup_table_name` | traducir códigos vía LookupTable |
| `table` | `source_field` (lista), `sub_mappings` (list) | mapear array→array (las líneas) |
| `nested_object` | `sub_mappings` (resuelven contra raíz; usar `path` dentro) | construir objeto (la dirección) |
| `accumulator` | `accumulate_fields` (list de paths, suma Decimal) | sumar |

**Caveats a recordar** (fallas comunes):
- `datetime`: para autodetectar el formato de origen **omitir `source_format`**; salida ISO ⇒
  `target_format:"iso"` o omitir; solo fecha ⇒ `target_format:"date"`. NO usar `"auto"`/`"iso8601"`.
- Campo anidado (ej `customer.id`): usar `field_type:"path"`, NO `simple` (simple busca la clave plana).
- `expression` corre en un sandbox (simpleeval). Si los montos vienen como **string**
  (ej `price:"100.00"`), `price*quantity` puede fallar — validarlo en la Fase 4 y ajustar.

---

## Prerequisitos

1. **Stack corriendo y migrado** (ver README §"Instalación y primer arranque"):
   `docker compose up -d` + `docker compose exec api alembic upgrade head`.
2. **Un tenant + un usuario admin verificado en ese tenant**, y su **JWT**. El profile/integration se
   crean bajo el `tenant_id` del usuario autenticado.
   - Crear superadmin: `docker compose exec api python scripts/create_admin.py` (o el flujo que uses).
   - Crear tenant: `POST /tenants` (requiere token admin).  ⚠️ confirmar rol/campos requeridos.
   - Obtener token: `POST /auth/login` → guardar `access_token`.
3. **Credenciales de Tienda Nube**: `store_id` + `access_token` de una app/tienda de prueba.
   ⚠️ obtenerlos del panel de desarrolladores de Tienda Nube.

Variables que se usan abajo (reemplazar):
`{{base_url}}=http://localhost:8000`, `{{token}}=<JWT del login>`,
`{{store_id}}`, `{{tn_token}}=<access_token Tienda Nube>`.

---

## Paso a paso

### Fase 1 — LookupTable de estados (traducir status de Tienda Nube → canónico)

`POST {{base_url}}/lookup-tables` (Bearer {{token}}):
```json
{
  "name": "TiendaNubeStatusMap",
  "entries": {
    "open": "confirmed",
    "closed": "completed",
    "cancelled": "cancelled"
  }
}
```
Valores de `status` confirmados en el payload real: `open`/`closed`/`cancelled`. Si preferís mapear el
estado de pago, creá otra tabla para `payment_status` (`paid`, `pending`, `authorized`, `refunded`, …).

### Fase 2 — MappingProfile `tiendanube` → `sales_order`

`POST {{base_url}}/profiles` (Bearer {{token}}). El body debe incluir `source_system`, `entity`,
`version` y el array `config`. **Versión ajustada a un payload REAL de Tienda Nube** (API 2025-03):

```json
{
  "source_system": "tiendanube",
  "entity": "sales_order",
  "version": "1.0.0",
  "config": [
    {"source_field": "id",        "target_field": "external_id",    "field_type": "expression", "expression": "str(id)"},
    {"source_field": "number",    "target_field": "order_number",   "field_type": "expression", "expression": "str(number)", "on_error": "skip"},
    {"source_field": "id",        "target_field": "customer_id",    "field_type": "expression", "expression": "str(customer['id'])"},
    {"source_field": "status",    "target_field": "status",         "field_type": "lookup",
       "lookup_table_name": "TiendaNubeStatusMap", "on_error": "default", "default_value": "pending"},
    {"source_field": "currency",  "target_field": "currency",       "field_type": "simple", "on_error": "skip"},
    {"source_field": "subtotal",  "target_field": "subtotal",       "field_type": "simple", "on_error": "skip"},
    {"source_field": "discount",  "target_field": "discount_total", "field_type": "simple", "on_error": "skip"},
    {"source_field": "total",     "target_field": "total",          "field_type": "simple"},
    {"source_field": "created_at","target_field": "ordered_at",     "field_type": "datetime", "on_error": "skip"},
    {"source_field": "updated_at","target_field": "updated_at",     "field_type": "datetime", "on_error": "skip"},

    {"source_field": "products", "target_field": "lines", "field_type": "table", "sub_mappings": [
      {"source_field": "product_id", "target_field": "product_id", "field_type": "expression", "expression": "str(product_id)"},
      {"source_field": "sku",        "target_field": "sku",        "field_type": "simple", "on_error": "skip"},
      {"source_field": "name",       "target_field": "description","field_type": "simple", "on_error": "skip"},
      {"source_field": "quantity",   "target_field": "quantity",   "field_type": "simple"},
      {"source_field": "price",      "target_field": "unit_price", "field_type": "simple"},
      {"target_field": "total", "field_type": "expression", "expression": "float(price) * quantity"}
    ]},

    {"source_field": "shipping_address", "target_field": "shipping_address", "field_type": "nested_object", "sub_mappings": [
      {"source_field": "shipping_address.address",  "target_field": "street",   "field_type": "path", "on_error": "skip"},
      {"source_field": "shipping_address.number",   "target_field": "number",   "field_type": "path", "on_error": "skip"},
      {"source_field": "shipping_address.floor",    "target_field": "floor",    "field_type": "path", "on_error": "skip"},
      {"source_field": "shipping_address.city",     "target_field": "city",     "field_type": "path", "on_error": "skip"},
      {"source_field": "shipping_address.province", "target_field": "state",    "field_type": "path", "on_error": "skip"},
      {"source_field": "shipping_address.country",  "target_field": "country",  "field_type": "path", "on_error": "skip"},
      {"source_field": "shipping_address.zipcode",  "target_field": "zip_code", "field_type": "path", "on_error": "skip"}
    ]}
  ]
}
```
Notas (basadas en el payload real):
- **`source_field` es obligatorio en TODOS los ítems de nivel superior** del `config` (lo exige el
  schema del API, `POST /profiles`). Incluso `table` y `nested_object` deben llevarlo, aunque
  internamente el `nested_object` lo ignora (sus `sub_mappings` se resuelven contra la raíz). Por eso
  el `nested_object` de la dirección lleva `"source_field": "shipping_address"` (valor de relleno).
  Los `sub_mappings` NO se validan por el schema, así que ahí sí podés omitir `source_field`
  (ej: el `expression` del total de línea).
- **IDs numéricos → castear a string en el perfil.** `id`, `number`, `customer.id` y `product_id`
  vienen como **número** y el canónico exige `string` (Pydantic v2 NO coacciona int→str). Por eso van
  con `expression` `str(...)`: `str(id)`, `str(number)`, `str(customer['id'])`, `str(product_id)`.
  Sin esto, la transformación falla con `schema_validation_error: Input should be a valid string`.
- **Total por línea**: el ítem de `products` NO trae total; se calcula con `float(price) * quantity`
  (el sandbox de simpleeval permite `float()`). Precisión float suficiente para el test; para dinero
  exacto se puede refinar luego.
- **`status`** es el ciclo del pedido (`open`/`closed`/`cancelled`). Si querés reflejar el pago, mapear
  `payment_status` (`paid`/`pending`/...) en su lugar y ajustar la LookupTable.
- **No hay campo de costo de envío** en el payload (el envío está en `fulfillments`); por eso no se
  mapea `shipping_total`. `discount` (cupón + gateway) va a `discount_total`.
- `completed_at` NO es un string sino un objeto `{date, timezone_type, timezone}` → no usarlo como
  datetime. Para fechas usar `created_at`/`updated_at`/`paid_at` (que sí son strings ISO).

### Fase 3 — IntegrationConfig con conector `api`

`POST {{base_url}}/integrations` (Bearer {{token}}). Guardar el `id` devuelto:
```json
{
  "name": "Tienda Nube Pedidos (test)",
  "connector_type": "api",
  "source_entity": "sales_order",
  "is_active": true,
  "config": {
    "source_system": "tiendanube",
    "base_url": "https://api.tiendanube.com",
    "endpoint": "/2025-03/{{store_id}}/orders?payment_status=paid",
    "auth_type": "api_key",
    "api_key_header": "Authentication",
    "api_key": "bearer {{tn_token}}",
    "headers": {
      "User-Agent": "MiIntegracion (servicios@morganatec.com)",
      "Accept": "application/json"
    },
    "data_path": null,
    "pagination": {
      "type": "page_number",
      "page_param": "page",
      "page_size_param": "per_page",
      "page_size": 200
    }
  }
}
```
Notas clave (confirmadas con el request real):
- **Versión en el path**: la URL real es `https://api.tiendanube.com/2025-03/{store_id}/orders`
  (la versión `2025-03` va en el path, NO `/v1`).
- **Auth**: Tienda Nube usa el header **`Authentication: bearer <token>`** (no el estándar
  `Authorization`). Por eso `auth_type:"api_key"` + `api_key_header:"Authentication"` +
  `api_key:"bearer <token>"`. Esto produce exactamente el header que ya usás en Postman.
- **`User-Agent` obligatorio** con datos de contacto → va en `headers`.
- **Filtros estáticos** (`payment_status=paid`, y si querés `updated_at_min`/`updated_at_max`) van
  **dentro del string `endpoint`** — httpx los combina con los de paginación (`page`/`per_page`).
  ⚠️ Ojo: el conector `api` NO templatea fechas por ejecución, así que un `updated_at_min` fijo no
  "avanza" solo en corridas programadas. Para el test está bien; para producción recurrente conviene
  usar la ventana de fecha del día o webhooks (ver Anexo).
- `GET /orders` devuelve el **array directo** → `data_path:null`. Confirmado en tu respuesta de ejemplo.
- Paginación `page`/`per_page`, `per_page` máx **200** (el que usás).

### Fase 4 — Validar el mapeo con un payload de ejemplo (el corazón de la prueba)

Tomar un JSON de pedido **real de la doc/sandbox de Tienda Nube** y dispararlo sin llamar a la API:

`POST {{base_url}}/integrations/{id}/trigger` (Bearer {{token}}):
```json
{
  "source_system": "tiendanube",
  "entity": "sales_order",
  "raw_payload": { "...": "⚠️ pegar aquí un pedido de ejemplo de Tienda Nube" }
}
```
Devuelve un `trace_id`. Seguir el mensaje por el pipeline:
- `GET {{base_url}}/executions/{trace_id}` → estado (pending→processing→ok/error).
- `GET {{base_url}}/executions/{trace_id}/logs` → eventos: `profile_loaded`, `field_mapped`,
  `schema_validated`, y errores de validación con el campo exacto que falló.

**Iterar**: si `schema_validated` falla (falta `total`/`customer_id`/`line.total`, formato de fecha,
etc.), ajustar el profile (Fase 2 con `PATCH /profiles/{id}` o nueva versión) y repetir el trigger
hasta que el canónico valide. Aquí es donde se afinan los nombres de campos reales de Tienda Nube.

### Fase 5 — Pull real desde Tienda Nube

Con las credenciales cargadas en la IntegrationConfig:
`POST {{base_url}}/integrations/{id}/run` (Bearer {{token}}) → encola el conector; responde `task_id`.
Monitorear: `GET {{base_url}}/executions?source_system=tiendanube` (lista de mensajes y su estado).

### Fase 6 — Automatizar el pull (scheduler + ventana incremental)

**Activar el pull programado** (cero código): `PATCH /integrations/{id}` con un `schedule` cron, ej cada
15 min: `"schedule": "*/15 * * * *"`. El `DatabaseScheduler` (servicio `beat`) lo toma en ≤60s y dispara
`run_integration_connector` solo. Requisito: `docker compose ps` → `mconnect_beat` en `Up`.

**Ventana incremental** (para no reprocesar los mismos pedidos en cada corrida): el conector `api`
soporta los placeholders `{last_run_at}` y `{now}` en el `endpoint`, que se sustituyen en cada corrida.
`{last_run_at}` lo alimenta el runner con la última ejecución (en la 1ª corrida usa
`now - initial_lookback_minutes`, default 1 día). Ejemplo en el `config` de la integración:
```
"endpoint": "/2025-03/7949541/orders?payment_status=paid&updated_at_min={last_run_at}"
```
Opcionales del `config`: `initial_lookback_minutes` (ventana de la 1ª corrida) y `date_format`
(strftime; default ISO 8601). Así cada tick trae solo lo actualizado desde la corrida anterior.
Verificar con `last_run_stats` en `GET /integrations/{id}` (dos `POST /run` seguidos → el 2º trae 0).

### Fase 7 — Entrega a Finnegans como **Pedido de Venta**

Una vez que el canónico valida (Fase 4), el worker de `delivery` lo entrega **automáticamente** a
Finnegans. El flujo: `transform_message` → encola `deliver_message` → resuelve el **documento destino**
según la integración → resuelve el **MappingProfile de SALIDA** correspondiente → transforma canónico →
forma Finnegans → el conector postea al endpoint.

**Dos documentos de venta disponibles** (se elige por integración, ver Paso 2):

| Documento | `finnegans_document` | Conector | Endpoint | Perfil de salida (`source_system`) |
|---|---|---|---|---|
| **Pedido de Venta** (default) | `pedido_venta` | `finnegans` | `POST /api/pedidoVenta` | `finnegans` |
| **Punto de Venta** (factura mostrador) | `punto_venta` | `finnegans_punto_venta` | `POST /api/PuntoVentaItem` | `finnegans_punto_venta` |

Ambos en [`connectors/output/finnegans_connector.py`](../connectors/output/finnegans_connector.py)
(atributo `ENTITY_ENDPOINTS`). Auth OAuth2 client_credentials; el token va como query param `ACCESS_TOKEN`.

**Paso 1 — Credenciales Finnegans.** Para dev/single-tenant, en `.env`:
```
FINNEGANS_CLIENT_ID=...
FINNEGANS_SECRET_KEY=...
FINNEGANS_API_BASE_URL=https://api.finneg.com
```
y **recrear el worker** (es quien entrega): `docker compose up -d --force-recreate worker`.
(Producción: credenciales por tenant/integración cifradas con Fernet.)

**Paso 2 — Elegir el documento en la integración.** Agregá `finnegans_document` al `config` de la
IntegrationConfig de Tienda Nube (`PATCH /integrations/{id}`), junto a la config del conector api:
`"finnegans_document": "pedido_venta"` (default si se omite) o `"punto_venta"`. El worker de delivery
lo lee y elige el conector + el perfil de salida correctos.

**Paso 3 — Perfil de salida `pedidoVenta`** (`POST {{base_url}}/profiles`, Bearer {{token}}). Mapea el
canónico `sales_order` a los campos obligatorios de `pedidoVenta`. Plantilla (ajustar los ⚠️ con los
códigos maestros reales de tu cuenta Finnegans). Ya existe como seed:
`mapping_profiles/finnegans/pedido_venta.json` (lo carga `scripts/seed_finnegans_profiles.py`):
```json
{
  "source_system": "finnegans",
  "entity": "sales_order",
  "version": "1.0.0",
  "config": [
    {"source_field": "external_id", "target_field": "IdentificacionExterna", "field_type": "simple"},
    {"source_field": "ordered_at",  "target_field": "Fecha", "field_type": "datetime", "target_format": "date"},
    {"source_field": "customer_id", "target_field": "OrganizacionID", "field_type": "simple"},
    {"source_field": "currency", "target_field": "MonedaID", "field_type": "lookup",
       "lookup_table_name": "FinnegansMonedaMap", "on_error": "default", "default_value": "PES"},
    {"source_field": "external_id", "target_field": "CondicionPagoID",    "field_type": "constant", "value": "CONTADO"},
    {"source_field": "external_id", "target_field": "TransaccionTipoID",  "field_type": "constant", "value": "OPER"},
    {"source_field": "external_id", "target_field": "TransaccionSubtipoID","field_type": "constant", "value": "⚠️_SUBTIPO"},
    {"source_field": "external_id", "target_field": "WorkflowID",         "field_type": "constant", "value": "VENTAS"},
    {"source_field": "external_id", "target_field": "EmpresaID",          "field_type": "constant", "value": "⚠️_EMPRESA"},
    {"source_field": "lines", "target_field": "OperacionItems", "field_type": "table", "sub_mappings": [
      {"source_field": "sku",        "target_field": "ProductoID",           "field_type": "simple"},
      {"source_field": "quantity",   "target_field": "CantidadWorkflow",     "field_type": "simple"},
      {"source_field": "unit_price", "target_field": "Precio",               "field_type": "simple"},
      {"source_field": "sku",        "target_field": "Descuento1",           "field_type": "constant", "value": "0"},
      {"source_field": "sku",        "target_field": "IdentificacionExterna","field_type": "simple"}
    ]}
  ]
}
```
Notas:
- **`source_field` obligatorio en todo ítem de nivel superior** (aunque `constant`/`table` no lo usen);
  por eso los `constant` llevan un `source_field` de relleno (ej `external_id`).
- `Fecha` en formato `aaaa-mm-dd` (por eso `target_format:"date"`).
- Crear la LookupTable de moneda: `POST /lookup-tables` con
  `{"name":"FinnegansMonedaMap","entries":{"ARS":"PES","USD":"DOL"}}`.

**Paso 4 — ⚠️ Datos maestros.** `OrganizacionID` (cliente), `ProductoID` (por SKU), `CondicionPagoID`,
`TransaccionSubtipoID`, `EmpresaID` y `MonedaID` deben ser **códigos que existan en Finnegans**. Si no,
la API responde 4xx y el mensaje queda en `error` permanente (`connector_client_error`). Obtenerlos con
las APIs `/list` de Finnegans (`/Cliente/list`, `/Producto/list`, `/CondicionPago/list`,
`/TransaccionSubtipo/list`, `/Empresa/list`, `/Moneda/list`) y volcarlos como constantes/LookupTables.
Si los SKU/clientes de Tienda Nube no coinciden con los códigos de Finnegans, agregar LookupTables que
traduzcan (ej `TiendaNubeSkuToProductoID`).

### Alternativa: entregar como Punto de Venta

Si en vez de Pedido de Venta querés **Punto de Venta** (factura de mostrador), en el Paso 2 poné
`"finnegans_document": "punto_venta"` y creá el perfil de salida con `source_system:"finnegans_punto_venta"`
y la forma de `PuntoVentaItem` (campos `ClienteID`, `ImporteTotal`, `ItemsProductos[]`,
`ComprobanteTipoImpositivoID`, …). Ya existe como seed:
`mapping_profiles/finnegans/punto_venta.json`. Nada más cambia — el conector `finnegans_punto_venta` se
selecciona solo según el campo de la integración.

---

## Verificación / criterio de éxito

- Fase 4: `GET /executions/{trace_id}` termina en estado OK y los logs muestran `schema_validated`
  sin errores → **el mapeo Tienda Nube→canónico es correcto**.
- Fase 5: `GET /executions?source_system=tiendanube` muestra los pedidos reales ingeridos.
- El JSON canónico intermedio cumple `schemas/sales_order.json` (external_id, customer_id, total,
  lines[] con product_id/quantity/unit_price/total).

## Troubleshooting: el mensaje quedó "queued" y no aparece en /executions

Síntoma: `trigger`/`run` devuelve un `trace_id` con `status:"queued"`, pero
`GET /executions/{trace_id}` y `/logs` dan **404 "Mensaje no encontrado"** y no hay filas en
`message_states`/`execution_logs`.

Causa: la API solo **encola** en RabbitMQ y responde al instante. Quien escribe el estado en PostgreSQL
es el **worker de Celery** (`mconnect_worker`). Si el worker no está corriendo o no consume la cola
`ingestion`, el mensaje nunca se procesa y no hay registro que consultar. Un `trace_id "queued"` NO
garantiza procesamiento.

Diagnóstico:
```bash
# 1. ¿Está Up el worker? ¿RabbitMQ healthy?
docker compose ps                    # mconnect_worker debe estar "Up"

# 2. Logs del worker: arranque + errores
docker compose logs worker --tail=150
#    Buscar: "celery@... ready." y la línea [queues] con ingestion,transformation,delivery,retry,connector.
#    Un traceback al arrancar = crash de import (no llega a consumir).

# 3. RabbitMQ UI (http://localhost:15672, guest/guest) → Queues → "ingestion":
#    Ready>0 y consumers=0 → el worker no está consumiendo.
```
Fix según hallazgo:
- Worker ausente/`Exited` → `docker compose up -d --build worker`.
- Worker en `Restarting` (traceback) → leer el error, `docker compose up -d --build worker`.
- Worker `Up` pero sin consumir → `docker compose up -d --force-recreate worker`.

Luego reprocesar el `trigger`/`run`. El mensaje ahora aparece en `/executions/{trace_id}`. Si termina
en `error`, el log (`/logs`) indica la etapa exacta (perfil de entrada, schema, perfil de salida o
credenciales) — eso ya es el pipeline funcionando.

---

## Anexo: Ingesta por Webhooks (tiempo real)

### Qué es un webhook (en 30 segundos)

- **Pull (lo de arriba)**: MConnect le *pregunta* cada X minutos a Tienda Nube "¿hay pedidos nuevos?".
- **Webhook (push)**: Tienda Nube le *avisa* a MConnect en el instante en que pasa algo (ej: un pedido
  se pagó), haciendo un `POST` a una URL tuya. No hay que preguntar: llega solo, al toque.

### Cómo recibe webhooks MConnect

Endpoint: **`POST {{base_url}}/webhooks/{integration_id}`** (público, sin JWT — un sistema externo no
tiene token). Al recibir un POST, MConnect:
1. Busca la integración por `{integration_id}`; debe ser `connector_type:"webhook"` y `is_active:true`
   (si no, responde 404).
2. Si el `config` tiene `secret`, **valida la firma HMAC** del body (autenticación del que llama).
3. Responde **200 al toque** y encola el trabajo en background (para no hacer esperar al que llama).
4. Según el `config`, en dos modos:
   - **Sin `fetch`** → toma el payload recibido (opcional `config.data_path`) y lo manda al pipeline
     tal cual (para plataformas que mandan el recurso completo).
   - **Con `fetch`** → extrae el id del aviso (`config.id_path`) y **va a buscar el recurso completo**
     a la API antes de transformar (hidratación). Es la feature genérica que resuelve el caso Tienda Nube.

### El aviso de Tienda Nube es liviano → se resuelve con `fetch`

Los webhooks de Tienda Nube **NO mandan el pedido completo**. Mandan un aviso liviano:
```json
{ "store_id": 7949541, "event": "order/paid", "id": 2017841650 }
```
Solo el **id**, sin `total`/`customer`/`products`. Por eso MConnect trae el pedido completo con el
bloque **`fetch`** de la integración (hace `GET .../orders/{id}`) antes de transformar. El recurso
hidratado usa el **mismo MappingProfile de entrada** que el pull (`tiendanube→sales_order`).

Esto es **genérico**: cualquier plataforma cuyo webhook mande un id + recurso consultable (Shopify,
Woo, etc.) se integra por configuración (`id_path` + `fetch.endpoint` con `{id}`), sin código nuevo.

### Tus opciones

1. **Pull por API programado** (Fase 6): más simple, no depende de exponer tu localhost. Buen default.
2. **Webhook con `fetch` (tiempo real)**: el aviso dispara la hidratación + entrega al instante. Ya
   está implementado (config `fetch` + `id_path`); pasos abajo.
3. **Simulación sin exponer nada**: `POST /webhooks/{id}` mandando vos un **pedido completo** en una
   integración webhook **sin** `fetch` → valida el endpoint + el profile de punta a punta.

### Pasos para montar el webhook

**Paso 1 — Crear la integración webhook en MConnect** (`POST {{base_url}}/integrations`, Bearer token).
El bloque `fetch` (forma de config de conector `api`, con `{id}` en el endpoint) y `id_path` habilitan
la hidratación:
```json
{
  "name": "Tienda Nube Webhook Pedidos",
  "connector_type": "webhook",
  "source_entity": "sales_order",
  "is_active": true,
  "config": {
    "source_system": "tiendanube",
    "secret": "un-secreto-compartido-fuerte",
    "signature_header": "x-linkedstore-hmac-sha256",
    "signature_algorithm": "sha256",
    "id_path": "id",
    "fetch": {
      "base_url": "https://api.tiendanube.com",
      "endpoint": "/2025-03/7949541/orders/{id}",
      "auth_type": "api_key",
      "api_key_header": "Authentication",
      "api_key": "bearer {{tn_token}}",
      "headers": { "User-Agent": "MiIntegracion (servicios@morganatec.com)" }
    }
  }
}
```
Guardá el `id` devuelto: tu URL de webhook es `{{base_url}}/webhooks/{ese-id}`.
- `id_path`: dónde está el id del recurso en el aviso (Tienda Nube: `"id"`).
- `fetch.endpoint`: el `{id}` se reemplaza con el id del aviso; el resto es como el conector api del pull.
- `secret`: si lo ponés, MConnect valida la firma HMAC. Para una 1ª prueba local podés **omitirlo**.
- ⚠️ Tienda Nube firma con el **client_secret de tu app** (header `x-linkedstore-hmac-sha256`,
  HMAC-SHA256 del body). Confirmalo en su doc y poné ese valor en `secret` y `signature_header`.
- Si una plataforma manda el **recurso completo** en el webhook, **omití `fetch`/`id_path`** → se usa
  el payload tal cual (con `data_path` opcional).

**Paso 2 — Exponer tu localhost a internet.** Tienda Nube necesita una URL **pública HTTPS** para
llegar a tu máquina. En local usá un túnel:
```bash
# opción A
ngrok http 8000
# opción B
cloudflared tunnel --url http://localhost:8000
```
Te da una URL tipo `https://ab12cd.ngrok.app`. Tu webhook público queda:
`https://ab12cd.ngrok.app/webhooks/{integration_id}`.

**Paso 3 — Registrar el webhook en Tienda Nube** (con tu token de app, mismos headers que el GET):
```bash
curl -X POST 'https://api.tiendanube.com/2025-03/{{store_id}}/webhooks' \
  --header 'Authentication: bearer {{tn_token}}' \
  --header 'User-Agent: MiIntegracion (servicios@morganatec.com)' \
  --header 'Content-Type: application/json' \
  --data '{
    "event": "order/paid",
    "url": "https://ab12cd.ngrok.app/webhooks/{integration_id}"
  }'
```
Eventos útiles de pedidos: `order/created`, `order/paid`, `order/fulfilled`, `order/cancelled`,
`order/updated`. ⚠️ Confirmá la lista y el formato en la doc de Tienda Nube.

**Paso 4 — Probar.**
- **Real (con `fetch`)**: generá un pedido de prueba en la tienda y pagalo → Tienda Nube manda el aviso
  liviano a tu URL. MConnect hidrata (hace `GET .../orders/{id}`), transforma y entrega. Seguí el
  `trace_id` que devuelve el webhook con `GET /executions/{trace_id}` y `/logs`. Cadena esperada:
  `ingestion_received → … → delivery_completed`. Si el fetch falla (4xx/timeout), lo vas a ver en los
  logs del **worker** (el task `fetch_and_ingest` reintenta con backoff).
- **Simulación (sin exponer nada)**: en una integración webhook **sin** `fetch`, `POST /webhooks/{id}`
  con un pedido completo de ejemplo en el body → valida endpoint + profile de punta a punta.

### Recomendación

Ambas vías ya funcionan. Para latencia baja (impacto inmediato al pagar), usá el **webhook con
`fetch`**. Si preferís simplicidad y no exponer tu servidor, el **pull programado** (Fase 6) alcanza.
Nada impide tener las dos integraciones en paralelo (pull como red de seguridad + webhook en tiempo real);
la idempotencia por `IdentificacionExterna` en Finnegans evita duplicar el pedido.

---

## Estado (resuelto con el payload real vs pendiente)

Ya **confirmado** con el request y la respuesta reales (store 7949541, API `2025-03`):
- ✅ Auth: `Authentication: bearer <token>` (mapeado a `api_key`).
- ✅ Endpoint: `/2025-03/{store_id}/orders`, respuesta = array directo (`data_path:null`).
- ✅ Paginación: `page`/`per_page` (máx 200).
- ✅ Estructura del pedido y nombres de campos (id, number, customer.id, status, currency, subtotal,
  discount, total, created_at/updated_at, products[].{product_id,sku,name,price,quantity},
  shipping_address.{address,number,floor,city,province,country,zipcode}).
- ✅ Valores de `status`: open/closed/cancelled.

**Ya implementado en MConnect** (lado código listo, solo resta configurar):
- ✅ Entrega a Finnegans como **Pedido de Venta** (`/api/pedidoVenta`) y **Punto de Venta**
  (`/api/PuntoVentaItem`), elegible por integración con `config.finnegans_document` (Fase 7).
- ✅ **Pull programado** por cron (Fase 6) con **ventana incremental** (`{last_run_at}`/`{now}` en el endpoint).
- ✅ **Webhook con `fetch`** (hidratación del aviso liviano), genérico para cualquier plataforma (Anexo).

**Pendiente de confirmar con la doc de Tienda Nube** (para producción):
1. **Cómo se obtiene/renueva el `access_token`** (OAuth de la app) y si expira.
2. **Total por línea**: validar en Fase 4 que `float(price) * quantity` da el importe esperado
   (o si preferís precisión decimal exacta).
3. **Webhooks**: header y llave HMAC exactos (`x-linkedstore-hmac-sha256` + client_secret) y lista de
   eventos (`order/paid`, etc.) — ver Anexo.
4. **Datos maestros Finnegans**: `TransaccionSubtipoID`, `EmpresaID`, `CondicionPagoID`, `OrganizacionID`,
   `ProductoID` — deben existir en tu cuenta (relevar con las APIs `/list`).
5. **Rate limits**: para ajustar el `schedule` cron y evitar 429.

## Placeholders a completar

| Placeholder | Dónde | Valor |
|---|---|---|
| `{{store_id}}` | endpoint de la IntegrationConfig | `7949541` (tu tienda de prueba) |
| `{{tn_token}}` | `api_key` de la IntegrationConfig | ⚠️ **regenerar** (el compartido quedó expuesto) |
| `{{token}}` | header Bearer de todas las llamadas MConnect | del `POST /auth/login` |
