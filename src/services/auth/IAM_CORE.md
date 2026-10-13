# IAM: núcleo de sesión y conexión React

IAM-1 implementa los contratos de `m-connect-back/docs/iam-frontend-integration.md`.
IAM-2 conecta el gestor a `AuthContext`, las rutas React y el cliente Axios compartido.
Importar el núcleo IAM-1 no restaura sesiones, instala interceptores ni hace requests.

## Composición activa en IAM-2

1. Crear una instancia Axios **separada** con la misma URL de la API actual.
2. Pasarla a `createIamTransport(api)` para login, OTP, reenvío, refresh,
   `/users/me` y logout.
3. Crear `createIamStorage({ apiBaseUrl, temporaryStorage?, persistentStorage? })`
   y `createIamSession({ transport, storage, coordinator? })`.
4. Esperar `manager.checkCapabilities()` y llamar `manager.startSync()` en el
   bootstrap y antes de iniciar login. El paso OTP continúa ese login. Mostrar
   `IamCapabilityError.code` si falla. `acceptTokens()` vuelve a comprobar las
   capacidades antes de mutar.
   Desmontar el listener con la función devuelta por `startSync()` o `stopSync()`.
5. `iamRuntime.js` instala `installIamAxios(apiClient, { manager, apiBaseUrl,
   onForbidden })` una sola vez mientras el proveedor React está montado y lo
   desmonta tras una liberación efectiva.

El cliente compartido ya no lee `mconnect_session`. El transporte IAM usa otra
instancia Axios para que refresh y `/users/me` no pasen por los interceptores.
Si se inyecta un coordinador propio, éste debe ofrecer `assertAvailable()`
además de `runExclusive()` para que el preflight lo detecte.

## Ciclo React y acceso protegido

`App` monta un único `AuthProvider`; éste observa el controlador compartido
mediante `useSyncExternalStore`, adquiere el runtime en un efecto y llama a
`bootstrap()`. El bootstrap comprueba capacidades, instala la escucha
`storage`, restaura el refresh si existe, lo rota cuando hace falta y consulta
`GET /users/me`. Sólo publica `authenticated` después de validar ese perfil.
`ProtectedRoute` muestra carga durante ese proceso; no monta el layout privado
ni sus requests antes de resolverlo. Sin tenant activo muestra un estado sin
acceso de tenant, aunque `platform_role` sea `superadmin`. El selector de
tenant y la consola de plataforma todavía no existen.

Un desmontaje y montaje inmediato de React StrictMode conserva el runtime y
comparte el bootstrap en curso. Cuando la última referencia se libera de forma
efectiva, el runtime suspende el controlador, invalida el bootstrap cacheado,
desinstala interceptores y detiene la escucha `storage`. El próximo montaje
empieza en `bootstrapping`, reinstala una sola escucha y revalida el refresh y
`/users/me` antes de volver a mostrar contenido privado. La generación del
controlador descarta respuestas del bootstrap anterior.

El login con `otp_required` deja el estado anónimo y guarda el desafío sólo
en memoria del flujo. La UI exige seis dígitos, muestra vencimiento y aplica
el cooldown visual del reenvío; el backend decide si el código sigue vigente.
`cancelOtp()`, usado al volver al ingreso o desmontar el formulario con un
desafío pendiente, invalida la intención, limpia la sesión local y descarta
verificaciones o reenvíos tardíos. Una respuesta de un desafío anterior no
puede completar otro login. El desmontaje provocado por una autenticación OTP
ya validada no revoca esa sesión.

Ante un 403 de un recurso protegido de negocio, el interceptor solicita al
controlador una revalidación de `/users/me` del mismo contexto. Las respuestas
403 concurrentes comparten la consulta mientras está en curso. El usuario y
rol visibles se actualizan con la respuesta; si ésta falla, no se inventa un
permiso. El request de negocio conserva su error original. Login, OTP,
recuperación, rutas públicas, logout, refresh y `/users/me` no disparan esta
revalidación. No hay polling global de permisos.

El logout quita inmediatamente la identidad visible, intenta
`POST /auth/logout` con Bearer y limpia la sesión local incluso si falla la
red. `revoked: false` se informa como revocación no confirmada. No se llama
automáticamente a `logout-all`; un logout tardío no borra un login posterior.

## API del gestor

- `checkCapabilities()` comprueba contexto seguro, generación segura de IDs,
  lectura y escritura en ambos almacenamientos y prueba Web Locks. Es una
  promesa que devuelve `{ available: true }` o rechaza con `IamCapabilityError`
  y código `insecure_context`, `secure_id_unavailable`, `storage_unavailable` o
  `coordination_unavailable`.
- `acceptTokens(pair, { rememberSession? })`: promesa; recibe el par **ya
  normalizado** de una respuesta `authenticated`, crea otro contexto de sesión y
  guarda únicamente el refresh. La opción por defecto es temporal. El preflight
  evita publicar un access cuando faltan capacidades.
- `restore()`: promesa; lee explícitamente el refresh bajo el mismo lock y
  devuelve `pending_restore` sin afirmar que el usuario está autenticado. Si el
  almacenamiento no concuerda con la marca, devuelve `recovery_required`.
- `refresh()`: promesa compartida por las llamadas simultáneas de una pestaña.
- `getAccessToken()`: sólo devuelve un access no vencido en memoria; durante
  `logging_out` devuelve `null`.
- `getState()`, `getContextSnapshot()`, `isSameContext()` y `subscribe()`:
  metadatos de ciclo de vida para IAM-2; no exponen el refresh a suscripciones.
- `startSync(eventTarget?)`: escucha cambios de la marca en `localStorage` y
  devuelve una función para desmontar; `stopSync()` también la desmonta. El
  target es inyectable en tests. Sin eventos de navegador lanza
  `IamCapabilityError('context_events_unavailable')`.
- `invalidateLocal()`: promesa; invalida la memoria de inmediato y borra el
  contexto guardado bajo la exclusión de rotación. `invalidateRejected(snapshot)`
  sólo limpia la revisión todavía rechazada después de un segundo 401.
- `logout()`: cierra el contexto, obtiene un access mediante refresh si hace
  falta, solicita revocación y borra el contexto local. Devuelve
  `{ revoked, localCleared, reason? }`.

Los estados son `uninitialized`, `restoring`, `absent`, `pending_restore`,
`tokens_available`, `logging_out` y `recovery_required`. `logging_out` es una
vista temporal del contexto en cierre. Incluso con tokens disponibles,
`userValidated` permanece en `false`: IAM-2 hará `/users/me` y publicará la
identidad validada. Nunca se guardan usuario, rol ni tenant como credencial.

`revoked: false` significa que **no se confirmó** la revocación remota; no
demuestra que la sesión siga vigente. `localCleared: false` significa que se
invalidó la memoria pero **no se confirmó** el borrado de la credencial
persistida. Si falta Web Locks, no se borra a ciegas una credencial que otra
pestaña podría estar rotando.

## Contratos backend y errores

`/auth/login` y `/auth/login/otp` devuelven `status=otp_required` (challenge,
sin tokens) o `status=authenticated` (par Bearer, `expires_in` y, a veces,
`device_token`). `/auth/login/otp/resend` sólo devuelve otro challenge.
`/auth/refresh` devuelve un nuevo par.

`/users/me` serializa `id`, `email`, `full_name`, `is_active`, `is_verified`,
`last_login`, `tenant_id`, `role`, `platform_role`, `created_at`, `updated_at`,
`memberships` y `support_session`. `full_name`, `last_login`, `tenant_id`,
`role`, `platform_role` y `support_session` pueden ser `null`; las membresías
pueden estar vacías. Cada membresía incluye `tenant_id`, `tenant_name`, `role`,
`status` y `tenant_is_active`. Una sesión de soporte incluye `id`, `tenant_id`,
`tenant_name`, `access_level` y `expires_at`. `platform_role=superadmin` no se
convierte en rol de tenant. El perfil no prueba por sí solo la autenticación.

`IamTransportError` expone `status`, `code`, `detail`, `fieldErrors`, `source` y
`displayMessage`. En 4xx conserva `detail` string, `detail[]` de validación
(`loc`, mensaje y tipo) o `error` de rate limit. No copia `input`, `ctx`, el
body completo ni el error Axios; oculta mensajes que reflejan credenciales o
códigos enviados. En 5xx sólo ofrece un mensaje genérico. Red
y timeout tienen códigos distintos. Las decisiones de sesión usan `status`
y `code`, nunca comparan textos. Un 401 de refresh es rechazo definitivo;
red, timeout, 5xx y respuestas inválidas dejan el resultado incierto.
Para endpoints IAM que IAM-2 agregue al transporte (recuperación, por ejemplo),
`normalizeIamError(error, { sensitiveValues })` aplica la misma política;
`sensitiveValues` debe incluir códigos, contraseñas y tokens enviados.

Login, OTP, recuperación, verificación, invitaciones públicas y `/health`
no reciben Bearer ni refresh automático. `/auth/logout` recibe el Bearer
explícito del transporte; las rutas protegidas conservan refresh preventivo,
un solo reintento ante 401 y validación del contexto de respuesta.

## Exclusión y fallos

La rotación usa Web Locks por alcance de API y una marca sin secretos en
`localStorage`. Login, refresh y limpieza del contexto usan el mismo lock.
Antes de enviar el refresh se marca `inflight`; una respuesta incierta de red,
timeout o 5xx deja esa marca y lleva a `recovery_required`. Así ninguna pestaña
vuelve a enviar una credencial posiblemente consumida. Un 401 definitivo borra
la sesión. Un refresh válido reemplaza access y refresh juntos y verifica la
generación del contexto antes de publicar la respuesta. IAM-3 debe reutilizar
este mismo mecanismo para el cambio de tenant, que también rota tokens.

Si Web Locks o el almacenamiento necesario no están disponibles, el camino de
rotación falla cerrado. No hay mutex casero con un booleano de `localStorage`.
Una pestaña con `sessionStorage` propio que detecta que otra rotó su copia pasa
a `recovery_required`; no usa el token viejo. Las pruebas usan un coordinador
serial inyectado. La integración real con varias pestañas y Web Locks requiere
una prueba de navegador al activar IAM-2.

Web Locks y `crypto.randomUUID()` requieren contexto seguro y navegador que
exponga ambas APIs. HTTPS es el entorno esperado en producción. Para desarrollo,
`http://localhost` y loopback son contextos potencialmente confiables en
navegadores compatibles; `http://` en un host no local no lo es. Almacenamiento
privado o bloqueado también puede impedir la sesión: manda el preflight real.

`startSync()` observa el evento nativo `storage` de la marca. Sólo circulan
metadatos de contexto y revisión, nunca access ni refresh. Otro contexto,
logout o marca de cierre invalidan la memoria local y avanzan su generación,
por lo que una respuesta tardía se descarta. Una rotación normal del mismo
contexto no provoca logout; el refresh relee la credencial bajo Web Locks.
La notificación no reemplaza al lock y no hay polling. Los tests usan eventos
y coordinadores inyectados, no validación E2E real entre navegadores.

El access vive sólo en memoria. El refresh se guarda en `sessionStorage` por
defecto y en `localStorage` sólo con `rememberSession: true`. La marca de
rotación siempre usa `localStorage`; por eso su bloqueo también impide aceptar
una sesión temporal segura. Las claves IAM incluyen el alcance de API y nunca
leen ni migran `mconnect_session`. `sessionStorage` y `localStorage` siguen
siendo accesibles a JavaScript: **no protegen los tokens frente a XSS**.
`device_token` se guarda por email normalizado y alcance de API sólo si el backend
lo devuelve tras elegir recordar dispositivo. El reset lo borra para ese email.

IAM-2 conecta bootstrap React, login y OTP, recuperación de contraseña,
`/users/me`, perfil (nombre y contraseña) y errores. El cliente compartido ya
no usa `mconnect_session`. La alta por `POST /users/` responde 410 en el
backend y su acción quedó retirada de la pantalla; listado, edición y
desactivación conservan los alias deprecados `/users/…` mientras sigan
disponibles. No hay alta con contraseña temporal ni flujo de invitaciones.

IAM-3 queda reservado para el selector y cambio de tenant; IAM-4 integrará
invitaciones y miembros mediante las rutas vigentes. La consola de plataforma
y las sesiones de soporte tampoco forman parte de IAM-2. El cambio de tenant
reemplazará el contexto con un par nuevo; los tokens de soporte necesitarán
un contexto separado del normal.

Los tests actuales ejercitan gestor, almacenamiento, interceptores y
controlador con adaptadores o eventos simulados. Todavía se requiere prueba
de navegador con Web Locks y varias pestañas, cierre y reapertura, remount
real de React, eventos DOM de OTP y cambios de membresía contra el backend
actual. La suite no equivale a una validación E2E.

Referencias de navegador: [contextos seguros](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts),
[Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API),
[`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
y [evento `storage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).
