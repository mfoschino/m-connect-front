# IAM: núcleo de sesión y conexión React

IAM-1 implementa los contratos de `m-connect-back/docs/iam-frontend-integration.md`.
IAM-2 conecta el gestor a `AuthContext`, las rutas React y el cliente Axios compartido.
IAM-3A agrega cambio seguro de tenant al mismo gestor.
IAM-3B.1 conecta esa operación con un selector visual y una frontera de remount.
Importar el núcleo IAM-1 no restaura sesiones, instala interceptores ni hace requests.

## Composición activa

1. Crear una instancia Axios **separada** con la misma URL de la API actual.
2. Pasarla a `createIamTransport(api)` para login, OTP, reenvío, refresh,
   switch-tenant, `/users/me` y logout.
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
ni sus requests antes de resolverlo. Sin tenant activo muestra el selector de
organización fuera del layout privado, aunque `platform_role` sea `superadmin`.
Si no hay membresías habilitadas, informa la situación y permite logout. La
consola de plataforma todavía no existe.

`authController.switchTenant(tenantId)` y `AuthContext.switchTenant` exponen la
operación a IAM-3B. Mientras ocurre, `status: 'switching'` deja `user: null` y
`ProtectedRoute` desmonta el contenido privado. El gestor confirma el par nuevo
para operaciones internas IAM, pero eso no habilita por sí solo la API de negocio.
`authController.isBusinessReady(context)` comprueba sin esperar a React que el
usuario y ese contexto estén validados; el interceptor Axios bloquea nuevas
requests privadas y sus respuestas mientras esa condición no se cumple. El
transporte IAM aislado sigue pudiendo consultar `/users/me`. Las rutas públicas
mantienen su tratamiento habitual. Si el destino responde 403, el gestor conserva
el contexto anterior y el controlador vuelve a consultar `/users/me` antes de
habilitarlo; el error queda disponible en el estado.

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
- `switchTenant(tenantId)`: promesa; usa el mismo Web Lock y reemplaza ambos
  tokens. Un éxito crea un `contextId` nuevo incluso cuando el backend conserva
  el mismo `sid`. Dos switches locales simultáneos no se ejecutan en paralelo.
- `getAccessToken()`: sólo devuelve un access no vencido en memoria; durante
  `switching` o `logging_out` devuelve `null`.
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
`tokens_available`, `switching`, `remote_switch`, `logging_out` y
`recovery_required`. `remote_switch` es transitorio al recibir una marca de
otra pestaña; el controlador intenta restaurar y validar de nuevo. `logging_out`
es una vista temporal del contexto en cierre. Incluso con tokens disponibles,
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
`POST /auth/switch-tenant` recibe Bearer y `{ "tenant_id": "<uuid>" }` y devuelve
el mismo contrato de par (`access_token`, `refresh_token`, `token_type`,
`expires_in`). Exige membresía activa y tenant no suspendido: sin acceso o con
organización suspendida responde 403, sin rotar. El backend conserva el `sid`,
cambia el tenant activo de la sesión y rota el refresh. El refresh viejo deja
de servir, pero un access anterior puede seguir autorizado para el tenant de
origen hasta que expire o la sesión se revoque. Por eso el frontend cambia su
frontera de contexto y no reutiliza respuestas ni retries anteriores.

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
`localStorage`. Login, refresh, switch y limpieza del contexto usan el mismo lock.
Antes de enviar el refresh se marca `inflight`; una respuesta incierta de red,
timeout o 5xx deja esa marca y lleva a `recovery_required`. Así ninguna pestaña
vuelve a enviar una credencial posiblemente consumida. Un 401 definitivo borra
la sesión. Un refresh válido reemplaza access y refresh juntos y verifica la
generación del contexto antes de publicar la respuesta. El switch obtiene un
access vigente mediante el refresh existente antes de tomar el lock del switch;
un 401 definitivo permite un único refresh y reintento fuera de ese lock. Bajo
exclusión relee contexto y revisión, marca `inflight` antes del request y
confirma el par junto con la nueva marca. Si red, timeout, 5xx, respuesta
inválida o persistencia dejan incierto el resultado, pasa a `recovery_required`
sin reenviar el refresh anterior. No reintenta automáticamente el switch.

Después de confirmar los tokens nuevos, el controlador consulta `/users/me`,
exige que `user.tenant_id` coincida con el destino y sólo entonces publica el
usuario y rol y habilita la API de negocio. Un valor inesperado deja la vista
privada y sus requests bloqueadas. Si falla
la red en `/users/me`, conserva el contexto nuevo protegido y `retry()` puede
revalidarlo; no vuelve al contexto anterior. Logout o login posterior invalidan
la intención del switch y descartan su respuesta tardía. El interceptor Axios
descarta éxitos y errores de requests anteriores a la frontera; nunca reenvía
una escritura vieja bajo el nuevo tenant. Una escritura ya recibida por el
backend puede completar en el tenant original.

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
metadatos de contexto, revisión, linaje y `transition: 'tenant_switch'`, nunca access
ni refresh. Otro contexto,
logout o marca de cierre invalidan la memoria local y avanzan su generación,
por lo que una respuesta tardía se descarta. Una rotación normal del mismo
contexto no provoca logout; el refresh relee la credencial bajo Web Locks.
La notificación no reemplaza al lock y no hay polling. Los tests usan eventos
y coordinadores inyectados, no validación E2E real entre navegadores.
Un switch remoto retira inmediatamente el access y el usuario anterior. Con
refresh persistente, el controlador restaura la credencial nueva bajo el lock,
renueva y valida `/users/me`. Con una copia independiente en `sessionStorage`,
la marca y la credencial no coinciden: se exige recuperación y no se reenvía
el refresh obsoleto. Un refresh normal conserva el contexto de frontend.

Cada login crea un `lineageId` aleatorio no secreto, derivado de su contexto
inicial. Refresh y switch conservan ese linaje aunque switch cambie la frontera
visual; un login nuevo crea otro. Los registros anteriores a este campo usan su
`contextId` como linaje al rotar. Logout anuncia la intención de cierre, espera
el mismo Web Lock, limpia el contexto inicial y cualquier contexto compartido
del mismo linaje. Si confirma la limpieza, libera el lock antes de enviar la
revocación remota. Si falla, mantiene ese lock durante un único intento de
revocación y reintenta la limpieza antes de liberarlo. El transporte HTTP activo
tiene timeout de 10 segundos; no se reenvía una revocación de resultado incierto.
La marca cerrada impide que otra pestaña confirme un switch del linaje cerrado;
los eventos de switch no inician `retry()` durante logout. Un login posterior de
otro linaje se preserva. `localCleared: true` confirma la limpieza del linaje,
no la revocación remota; `revoked: true` exige respuesta 204. Si fallan a la vez
Storage y la revocación remota, el frontend no puede garantizar el cierre entre
pestañas y devuelve ambos indicadores en `false`, sin publicar usuario.

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

IAM-3A deja lista la API de cambio y la protección de sesión. IAM-3B.1 usa
`AuthContext.switchTenant(tenantId)` desde el selector del Header. Las opciones
se construyen exclusivamente con `user.memberships` de `/users/me`; se identifica
la organización actual con `user.tenant_id`. Una membresía inactiva o un tenant
suspendido se muestran como no seleccionables con su motivo. No se conserva un
segundo tenant activo en React ni se manipulan tokens en el selector. El cambio
bloquea la selección repetida. Durante `switching`, `ProtectedRoute` desmonta el
layout privado y muestra el progreso. Un 403 sólo restituye el contexto anterior
después de revalidar `/users/me`; un resultado incierto muestra la recuperación
sin datos privados.

El controlador publica `contextId` sólo junto con un usuario autenticado y
validado. `MainLayout` usa ese identificador como clave de remount, sin desmontar
`AuthProvider` ni el gestor de sesión. El nuevo montaje reinicia el estado local,
los filtros, las selecciones, los modales y los formularios de Dashboard,
Integrations (incluidos MappingProfiles y LookupTables), Executions, Settings,
NotificationsMenu y UserAdminPage; sus efectos consultan de nuevo los datos del
tenant nuevo. En particular, se descarta el borrador local de credenciales
Finnegans, incluido `client_secret`. La protección Axios de IAM-3A rechaza las
respuestas antiguas y bloquea requests privadas mientras `/users/me` siga
pendiente. Una escritura ya enviada puede completarse en el tenant original;
el frontend no la repite automáticamente en el nuevo.

Al cambiar el contexto validado desde `/executions/:traceId`, la navegación va
al listado de ejecuciones antes de montar el detalle con ese ID. Si el nuevo rol
no es `admin`, `/settings/users` lleva a `/dashboard`. Las demás rutas generales
se conservan. El selector sin tenant activo no monta recursos del tenant ni
redirige repetidamente a login.

`NotificationsMenu` reinicia su lista y contador por el remount, pero el backend
actual no ofrece `/notifications`; su servicio existente no constituye una
integración extremo a extremo verificable. IAM-3B.2A aplica una política pura de
presentación a Integraciones, MappingProfiles y LookupTables. Lee únicamente
`user.role` y `user.tenant_id` del usuario validado por `/users/me`, junto con el
estado autenticado. El rol de una sesión de soporte ya llega efectivo como
`viewer` (`read_only`) o `admin` (`full`); `platform_role` y `memberships` no
otorgan permisos en el tenant activo. Viewer consulta; operator crea y edita
integraciones, perfiles y LookupTables, y ejecuta integraciones. Admin agrega
la eliminación de integraciones y LookupTables y el POST de desactivación de
perfiles. El PATCH de perfiles admite `is_active` para operator y admin; por
eso el formulario existente permite cambiar ese valor a ambos roles. La
acción separada de desactivación usa el POST reservado a admin. La
visibilidad y las guardas de callbacks evitan envíos accidentales; cada endpoint
sigue autorizando en el backend. Ante un cambio de rol validado, la pantalla se
remonta y descarta modales y borradores locales; el cambio de tenant conserva
el remount por `contextId` de IAM-3B.1. Un 403 continúa revalidando `/users/me`
sin reintentar escrituras.

IAM-3B.2B reutiliza esa política en la navegación y en credenciales Finnegans.
El Dashboard y el monitor/detalle de Ejecuciones conservan consultas, filtros y
refresco para viewer, operator y admin: sus controles actuales no despachan
escrituras. `POST /executions/{trace_id}/reprocess` exige operator, pero la UI
actual no ofrece esa acción. El Sidebar muestra Usuarios sólo al admin del
tenant activo; `/settings/users` conserva su `ProtectedRoute` por rol. Un
superadmin sin tenant no adquiere enlaces ni rutas administrativas de tenant.

El alias `GET /tenants/{tenant_id}/finnegans-credentials` permite admin y
soporte `read_only`/`full`; devuelve estado, `client_id` y `base_url`, nunca
`client_secret`. Su `PUT` y el PUT por integración exigen admin (el soporte
`read_only` no escribe). La política usa el rol efectivo y el resumen de soporte
validados por `/users/me`: viewer/operator no montan la consulta de credenciales,
soporte `read_only` sólo ve el estado y admin/soporte `full` pueden guardar. El
editor comprueba la capacidad antes del PUT y se remonta al cambiar contexto,
tenant, rol o sesión de soporte, descartando el borrador incluido el secreto.
Settings conserva sus demás tarjetas informativas. El servicio frontend sólo
usa el alias por tenant; no se añadió un flujo por integración. El backend
sigue autorizando cada request. IAM-4 queda a cargo de invitaciones y miembros.
En el detalle de Tienda Nube, Integraciones consulta ese GET sólo cuando la
política permite leer el estado de credenciales. Para operator y viewer no
despacha la consulta: el chequeo queda explícitamente no verificado. Ese
diagnóstico no bloquea por sí solo la ejecución de operator; faltantes
confirmados, errores de red/servidor y demás requisitos críticos sí bloquean.
El panel nunca presenta el estado no verificado como «listo». El botón usa
`canRunIntegrations` y `POST /integrations/{id}/run` vuelve a exigir operator
en el backend; un 202 indica corrida encolada, no entrega final exitosa. El
`has_credentials` del GET sólo confirma que hay ID y secreto cargados en la
instalación resuelta por el alias; no prueba autenticación remota. El
rechazo 403 del POST no reintenta la ejecución. Admin conserva la verificación
del estado y el enlace de configuración. No se muestran valores secretos.

La consola de plataforma y las sesiones de soporte siguen fuera de esta etapa;
sus tokens necesitarán un contexto separado del normal. Una sesión sin tenant
activo conserva el estado protegido `no_tenant`; IAM-3B.1 ofrece elegir uno
explícitamente.

Los tests actuales ejercitan gestor, almacenamiento, switch, readiness,
logout entre pestañas, interceptores y controlador con adaptadores o eventos
simulados. Todavía se requiere prueba
de navegador con Web Locks y varias pestañas, cierre y reapertura, remount real
de React (filtros, modales y borradores), eventos DOM de OTP, requests de negocio
pendientes y cambios de membresía contra el backend actual. Los tests del selector
renderizan React con perfiles simulados; la suite no equivale a una validación E2E.
Los tests de IAM-3B.2A verifican la política, el HTML estático de controles y el
enlace de guardas; quedan pendientes interacciones DOM reales con un modal
abierto y revocación de rol, además de la respuesta 403 del backend en navegador.
Los tests de IAM-3B.2B comprueban la matriz, controles renderizados y cableado
de las guardas. No ejercitan eventos DOM reales ni una revocación mientras el
formulario de credenciales está abierto. La ausencia de `/notifications` en el
backend sigue como pendiente independiente.

Referencias de navegador: [contextos seguros](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Secure_Contexts),
[Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API),
[`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID)
y [evento `storage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).

## IAM-4B: lectura de miembros del tenant activo

`UserAdminPage` consulta `GET /tenant/members` y `GET /tenant/members/{user_id}`
mediante el cliente Axios IAM existente. Ambos GET exigen `admin` del tenant
activo; el frontend no envía `tenant_id`. El `ProtectedRoute` de
`/settings/users`, la revalidación de `/users/me` tras 403 y el remount de
`MainLayout` por `contextId` siguen a cargo de IAM-2/IAM-3. El flujo de lectura
descarta respuestas antiguas al cambiar filtro, refrescar, cerrar o cambiar el
detalle y al desmontar la pantalla.

El listado usa `skip`, `limit` e `include_disabled`, con botón «Cargar más».
La respuesta es un array sin `total`: una página corta o vacía termina la
paginación. `include_disabled=true` puede incluir también cuentas globalmente
inactivas. `UserResponse.is_active` expresa acceso efectivo combinado de cuenta
y membresía; no informa el motivo de inactividad. `is_verified=false` no
significa invitación pendiente. `last_login` es global, no actividad del tenant.
El detalle muestra sólo datos de `UserResponse` y trata 404 como miembro ausente
de la organización activa.

Las escrituras existentes conservan transitoriamente los alias deprecados
`PUT /users/{id}` y `DELETE /users/{id}`. La regla de último administrador
permanece en el backend (409), ya que una página parcial no permite calcularla.
IAM-4C agrega invitaciones por separado; IAM-4D (migración de escrituras) e
IAM-4E siguen pendientes. Los tests comprueban servicio, flujo asíncrono y HTML
estático; faltan interacciones DOM y cambios reales de tenant/rol contra el backend en
navegador.

## IAM-4C: administración de invitaciones

La pestaña Invitaciones de `UserAdminPage` usa el cliente Axios IAM compartido
para `GET`/`POST /tenant/invitations`,
`POST /tenant/invitations/{id}/resend` y `DELETE /tenant/invitations/{id}`.
Sólo el rol efectivo `admin` del tenant activo puede montarla y sus callbacks
vuelven a comprobar `getIamPermissions` antes de escribir. No se envía
`tenant_id`, token ni contraseña. `InvitationResponse` informa el estado
efectivo (`pending`, `accepted`, `revoked`, `expired`); sólo `pending` permite
reenviar o revocar. El listado pagina con `skip`/`limit` sin total, filtra por
estado y descarta respuestas antiguas al cambiar filtro, refrescar, pestaña o
contexto. La creación valida email y rol (`operator` inicial), bloquea envíos
duplicados y sólo confirma éxito con 201; el reenvío exige 200 y la revocación
204. El backend encola el correo: la UI informa registro para envío, no
entrega al destinatario. Las tres escrituras de invitaciones optan por no
repetirse automáticamente tras un 401. El interceptor puede renovar la sesión,
pero deja el resultado sin confirmar y exige una nueva acción explícita. El
refresh preventivo anterior al primer despacho sí permite enviarlas una vez.
El GET conserva el retry IAM habitual. La revocación invalida el enlace
pendiente y no deshabilita una membresía.

Un 401 indica un problema de sesión; 403 deniega el acceso y dispara la
revalidación IAM de `/users/me`; 404 indica invitación ausente o ajena al tenant;
409 indica duplicado, estado incompatible o tenant suspendido; 422 señala datos
inválidos; 429 indica límite de tasa o de reenvíos. Ante red o 5xx, el resultado
de una escritura puede ser incierto: la UI no confirma éxito ni la reenvía
automáticamente.

IAM-4B sigue gestionando la pestaña Miembros y sus alias de escritura legacy;
IAM-4D migrará esas escrituras. La aceptación de invitaciones y los demás
flujos futuros de IAM-4E siguen pendientes. Los tests de IAM-4C ejercitan
servicio, concurrencia y HTML estático; faltan interacciones DOM y validación
con correo y cambio de tenant reales en navegador.

## IAM-4E: aceptación de invitaciones

Esta etapa agrega la capa de servicios de la pantalla pública `/invite`; la
pantalla en sí todavía no existe. Los contratos son `InvitationPreview` e
`InvitationAcceptResult` de `app/schemas/invitation.py` y §5.7 de
`iam-frontend-integration.md`.

- `iamAccount.inspectInvitation(token)`: `POST /auth/invitations/inspect`,
  pública (el interceptor quita cualquier Bearer). Devuelve el preview
  normalizado por `normalizeInvitationPreview` en snake_case: `email`,
  `tenant_name`, `role`, `invited_by` (string o `null`), `expires_at` y
  `account_exists`.
- `AuthContext.acceptInvitation({ token, password, fullName?, rememberSession? })`:
  crea la cuenta y abre sesión. El transporte aislado llama a
  `POST /auth/invitations/accept` y exige `status: "authenticated"`; un OTP u
  otra forma lanza `IamContractError('invalid_invitation_response')`. El
  controlador sigue el esqueleto de `beginLogin`: anula la intención de
  logout, avanza la generación, publica `bootstrapping`, espera la cancelación
  OTP pendiente, comprueba capacidades e **invalida la sesión local previa antes
  de enviar el token**, en el mismo orden que el login. Así una sesión de otra
  cuenta nunca convive con la nueva. Después usa `acceptAndValidate`
  (`rememberDevice: false`): sólo publica el usuario tras `/users/me`. Un logout
  o login intermedio descarta la respuesta tardía (`context_changed`).
- `iamAccount.acceptInvitationWithSession(token)`: `POST
  /users/me/invitations/accept` con el cliente IAM compartido. Devuelve
  `{ tenant_id, tenant_name, role }` sin cambiar el tenant activo; para operar
  allí, la pantalla llama a `switchTenant(tenant_id)`. Usa `_iamSkipAuthRetry`
  como las escrituras de IAM-4C: tras un 401 el interceptor puede renovar la
  sesión, pero no reenvía la aceptación; el resultado queda sin confirmar y
  exige otra acción explícita. Durante `bootstrapping` o `switching` el
  interceptor la rechaza antes de despacharla (`authorization_pending`,
  `switch_in_progress`); esos `IamSessionError` llegan tal cual, no como error
  de red.

Los tres usan `sensitiveValues` con el token (y la contraseña en el alta), por
lo que ningún `detail` que los refleje llega a la UI.

### Token pendiente

`iamInviteToken` (`createIamInviteTokenStore`) guarda el token mientras el
usuario pasa por el login. La clave sigue la convención de `iamStorage`:
`mconnect:iam:v1:<alcance de API codificado>:invite-token`, con el mismo
`normalizeApiScope`. Vive en `sessionStorage`: sólo esa pestaña lo ve y
desaparece al cerrarla. `get()`, `save(token)` y `clear()` no lanzan: si el
almacenamiento no está disponible devuelven `null`/`false` y la pantalla
puede seguir con el token en memoria.

Ciclo de vida: la pantalla lee el token del fragmento `#token=`, lo saca de la
URL y lo guarda sólo si debe pasar por el login. Lo borra al aceptar, ante 410
y al abandonar el flujo. El login lo conserva. **`logout()` del controlador lo
borra siempre**, de forma síncrona al inicio, porque hay varios disparadores de
logout (menú de perfil, selector de organización, `ProtectedRoute`) y ninguno
debe dejar un token olvidado.

Consecuencia para la pantalla: hay dos casos donde el usuario cierra sesión
**para continuar con la misma invitación**:

1. Cuenta existente con sesión de otro email (403 o detección previa): "Cerrá
   sesión e ingresá con esa cuenta".
2. Cuenta inexistente con otra sesión abierta: la pantalla pide cerrarla antes
   de mostrar el formulario de alta.

En ambos, la pantalla hace `await logout()` y **después** vuelve a guardar con
`iamInviteToken.save(token)` el token que conserva en memoria. Guardarlo antes
no sirve: el logout lo borra.

### Contraseña y errores

`validateNewPassword({ password, confirmPassword })` (en `iamUi.js`) contiene
las reglas que antes estaban en `ResetPasswordPage`: requerida, al menos 8
caracteres, mayúscula, minúscula, número, como máximo 72 bytes UTF-8 y
confirmación igual. Devuelve `{ password?, confirmPassword? }` con los mismos
mensajes; `ResetPasswordPage` la usa sin cambios de comportamiento. El backend
sigue siendo la autoridad (422).

`invitationAcceptErrorMessage(error, { email? })` devuelve
`{ message, fieldErrors }` y decide sólo por `status` y `loc`, nunca por texto:
410 o un 422 sobre `token` indican link inválido o vencido; 409 muestra el
`detail` saneado (cuenta existente o tenant suspendido) o un texto genérico;
422 mapea `password` y `full_name` a `fieldErrors.password`/`fieldErrors.fullName`;
403 indica que la invitación es para otro email; 400 indica cuenta superadmin.
Red, timeout, 429 y capacidades delegan en `authErrorMessage`. Es un helper
aparte porque `authErrorMessage` sólo devuelve texto.

Los tests de `test/iamInviteAccept.test.js` cubren normalizadores, transporte,
controlador con respuestas tardías, interceptor, store, reglas de contraseña y
mensajes sin secretos. Faltan la pantalla, interacciones DOM y la validación con
correo y backend reales en navegador.
