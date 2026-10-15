import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCurrentUser, normalizeLoginResponse, normalizeTokenPair } from '../src/services/auth/iamContracts.js'
import { createIamTransport, IamTransportError,
  normalizeIamError } from '../src/services/auth/iamTransport.js'
import { createIamStorage } from '../src/services/auth/iamStorage.js'
import { createIamSession, IamCapabilityError } from '../src/services/auth/iamSession.js'
import { IamCoordinationError, createWebLockCoordinator } from '../src/services/auth/iamCoordinator.js'
import { createMemoryStorage, createSerialCoordinator, createStorageEvents,
  deferred, tokenPair } from './iamFixtures.js'

const base = 'https://api.example.test'
const ids = () => {
  let next = 0
  return () => `id-${++next}`
}
const createSetup = ({ temporary = createMemoryStorage(), persistent = createMemoryStorage(),
  coordinator = createSerialCoordinator(), transport = {}, idFactory = ids(),
  secureContext } = {}) => {
  const storage = createIamStorage({ apiBaseUrl: base, temporaryStorage: temporary,
    persistentStorage: persistent })
  const manager = createIamSession({ storage, coordinator, idFactory, secureContext,
    clock: () => 1000,
    transport: { refresh: async () => tokenPair('two'), logout: async () => ({ revoked: true }), ...transport } })
  return { manager, storage, temporary, persistent }
}

test('login distingue challenge de tokens y rechaza respuestas antiguas o incompletas', () => {
  assert.deepEqual(normalizeLoginResponse({ status: 'otp_required', token_type: 'bearer',
    challenge_id: 'challenge-id', email_hint: 'a***@example.test', otp_expires_in: 599 }), {
    status: 'otp_required', tokenType: 'bearer', challengeId: 'challenge-id',
    emailHint: 'a***@example.test', otpExpiresIn: 599,
  })
  assert.equal(normalizeLoginResponse({ status: 'otp_required', token_type: 'bearer',
    challenge_id: 'challenge-id', email_hint: 'a***@example.test',
    otp_expires_in: 0 }).otpExpiresIn, 0)
  assert.equal(normalizeLoginResponse({ status: 'authenticated', token_type: 'bearer',
    access_token: 'access', refresh_token: 'refresh', expires_in: 60 }).refreshToken, 'refresh')
  assert.throws(() => normalizeLoginResponse({ access_token: 'old' }), { code: 'unknown_login_status' })
  assert.throws(() => normalizeLoginResponse({ status: 'authenticated', access_token: 'only' }),
    { code: 'invalid_token_pair' })
  assert.throws(() => normalizeLoginResponse({ status: 'otp_required', challenge_id: 'challenge',
    email_hint: 'hint', otp_expires_in: 30, token_type: 'bearer', access_token: 'unexpected' }),
  { code: 'invalid_otp_challenge' })
  assert.deepEqual(normalizeTokenPair({ access_token: 'a', refresh_token: 'r',
    token_type: 'bearer', expires_in: 60 }), {
    accessToken: 'a', refreshToken: 'r', tokenType: 'bearer', expiresIn: 60,
  })
  assert.throws(() => normalizeTokenPair({ access_token: 'a', refresh_token: 'r',
    token_type: 12, expires_in: 60 }), { code: 'invalid_token_pair' })
})

test('transporte usa los bodies IAM y logout acepta 204 sin body', async () => {
  const calls = []
  const api = {
    post: async (...args) => {
      calls.push(args)
      const path = args[0]
      if (path === '/auth/login' || path === '/auth/login/otp') return { data: {
        status: 'otp_required', challenge_id: 'challenge', email_hint: 'a***@example.test',
        otp_expires_in: 60, token_type: 'bearer',
      } }
      if (path === '/auth/login/otp/resend') return { data: {
        status: 'otp_required', challenge_id: 'challenge-2', email_hint: 'a***@example.test',
        otp_expires_in: 60, token_type: 'bearer',
      } }
      if (path === '/auth/refresh') return { data: { access_token: 'a',
        refresh_token: 'r', token_type: 'bearer', expires_in: 60 } }
      return { status: 204 }
    },
    get: async (...args) => {
      calls.push(args)
      return { data: { id: 'user', email: 'a@example.test', full_name: 'Ana',
        is_active: true, is_verified: true, last_login: null,
        created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-02T12:00:00Z',
        tenant_id: null, role: null, platform_role: null, memberships: [], support_session: null } }
    },
  }
  const iam = createIamTransport(api)
  assert.equal((await iam.login({ email: 'a@example.test', password: 'secret',
    deviceToken: 'device' })).status, 'otp_required')
  assert.deepEqual(calls[0][1], { email: 'a@example.test', password: 'secret', device_token: 'device' })
  assert.equal((await iam.verifyOtp({ challengeId: 'challenge', code: '123456',
    rememberDevice: true })).status, 'otp_required')
  assert.deepEqual(calls[1][1], { challenge_id: 'challenge', code: '123456', remember_device: true })
  assert.equal((await iam.resendOtp('challenge')).challengeId, 'challenge-2')
  assert.deepEqual(calls[2][1], { challenge_id: 'challenge' })
  assert.equal((await iam.refresh('opaque-token')).refreshToken, 'r')
  assert.deepEqual(calls[3][1], { refresh_token: 'opaque-token' })
  const user = await iam.getCurrentUser('access')
  assert.equal(user.tenant_id, null)
  assert.equal(user.role, null)
  assert.equal(user.full_name, 'Ana')
  assert.deepEqual(user.memberships, [])
  assert.equal(user.support_session, null)
  assert.equal(calls[4][1].headers.Authorization, 'Bearer access')
  assert.deepEqual(await iam.logout('access'), { revoked: true })
  assert.equal(calls[5][2].headers.Authorization, 'Bearer access')
})

test('respuesta de /users/me conserva tenant, plataforma y soporte sin inventar valores', () => {
  const user = { id: 'u', email: 'u@example.test', full_name: null,
    is_active: true, is_verified: false, last_login: null,
    created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-02T12:00:00Z', tenant_id: null,
    role: null, platform_role: 'superadmin', memberships: [{ tenant_id: 't',
      tenant_name: 'Tenant', role: 'viewer', status: 'active', tenant_is_active: true }],
    support_session: { id: 's', tenant_id: 't', tenant_name: 'Tenant',
      access_level: 'read_only', expires_at: '2026-10-08T12:00:00Z' } }
  assert.deepEqual(normalizeCurrentUser(user), user)
  assert.throws(() => normalizeCurrentUser({ id: 'u', email: 'u@example.test' }),
    { code: 'invalid_current_user' })
})

test('transporte informa respuesta HTTP incompleta como contrato inválido', async () => {
  const api = { post: async () => undefined, get: async () => undefined }
  const transport = createIamTransport(api)
  await assert.rejects(transport.login({ email: 'a@example.test', password: 'secret' }),
    { code: 'invalid_login_response' })
  await assert.rejects(transport.refresh('opaque'), { code: 'invalid_token_pair' })
  await assert.rejects(transport.getCurrentUser('access'), { code: 'invalid_current_user' })
  await assert.rejects(transport.logout('access'), { code: 'invalid_logout_response' })
})

test('almacenamiento temporal por defecto no persiste access ni usuario y no toca legacy', async () => {
  const temporary = createMemoryStorage({ mconnect_session: 'legacy' })
  const { manager, persistent } = createSetup({ temporary })
  await manager.acceptTokens(tokenPair())
  assert.equal(manager.getAccessToken(), 'access-one')
  assert.equal(manager.getState().userValidated, false)
  assert.equal(manager.getState().mode, 'temporary')
  assert.equal(temporary.getItem('mconnect_session'), 'legacy')
  assert.equal(temporary.entries().some(([, value]) => value.includes('access-one')), false)
  assert.equal(persistent.entries().some(([, value]) => value.includes('refresh-one')), false)
  assert.equal(temporary.entries().some(([, value]) => value.includes('refresh-one')), true)
})

test('persistencia larga exige opción explícita y restore no autentica al usuario', async () => {
  const { manager, storage, temporary, persistent } = createSetup()
  await manager.acceptTokens(tokenPair(), { rememberSession: true })
  assert.equal(manager.getState().mode, 'persistent')
  assert.equal(temporary.entries().some(([, value]) => value.includes('refresh-one')), false)
  assert.equal(persistent.entries().some(([, value]) => value.includes('refresh-one')), true)
  const restored = createIamSession({ storage, coordinator: createSerialCoordinator(),
    idFactory: ids(), clock: () => 1000,
    transport: { refresh: async () => tokenPair('two'), logout: async () => ({ revoked: true }) } })
  assert.equal(restored.getState().status, 'uninitialized')
  assert.equal((await restored.restore()).status, 'pending_restore')
  assert.equal(restored.getAccessToken(), null)
  assert.equal(restored.getState().userValidated, false)
})

test('claves IAM quedan separadas por API configurada', async () => {
  const temporary = createMemoryStorage()
  const persistent = createMemoryStorage()
  const one = createSetup({ temporary, persistent })
  await one.manager.acceptTokens(tokenPair())
  const another = createIamStorage({ apiBaseUrl: 'https://other.example.test',
    temporaryStorage: temporary, persistentStorage: persistent })
  assert.equal(another.readCredentials(), null)
  assert.equal(another.readMarker(), null)
  assert.equal(one.storage.readCredentials().refreshToken, 'refresh-one')
})

test('storage corrupto o inaccesible falla cerrado sin migrar legacy', async () => {
  const { manager, storage, temporary } = createSetup()
  await manager.acceptTokens(tokenPair())
  const key = temporary.entries().find(([name]) => name.endsWith(':refresh'))[0]
  temporary.setItem(key, '{broken')
  assert.throws(() => storage.readCredentials(), { code: 'corrupt_storage' })
  assert.equal(temporary.getItem(key), null)
  const blocked = { getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  const setup = createSetup({ persistent: blocked })
  await assert.rejects(setup.manager.acceptTokens(tokenPair()), { code: 'storage_unavailable' })
  assert.equal(setup.manager.getState().status, 'uninitialized')
})

test('importar los módulos nuevos no lee ni migra la sesión legacy', async () => {
  const previousLocal = globalThis.localStorage
  const previousSession = globalThis.sessionStorage
  let touches = 0
  const observer = { getItem: () => { touches += 1; return null },
    setItem: () => { touches += 1 }, removeItem: () => { touches += 1 } }
  globalThis.localStorage = observer
  globalThis.sessionStorage = observer
  try {
    await import('../src/services/auth/iamSession.js?import-isolation')
    await import('../src/services/auth/iamStorage.js?import-isolation')
    assert.equal(touches, 0)
  } finally {
    globalThis.localStorage = previousLocal
    globalThis.sessionStorage = previousSession
  }
})

test('refresh concurrente comparte request y reemplaza el par completo', async () => {
  const waiting = deferred()
  let calls = 0
  const { manager, storage } = createSetup({ transport: {
    refresh: async (token) => { calls += 1; assert.equal(token, 'refresh-one'); return waiting.promise },
  } })
  await manager.acceptTokens(tokenPair())
  const first = manager.refresh()
  const second = manager.refresh()
  assert.equal(first, second)
  waiting.resolve(tokenPair('two'))
  assert.deepEqual(await Promise.all([first, second]), ['access-two', 'access-two'])
  assert.equal(calls, 1)
  assert.equal(manager.getAccessToken(), 'access-two')
  assert.equal(storage.readCredentials().refreshToken, 'refresh-two')
  assert.equal(storage.readMarker().phase, 'ready')
})

test('dos pestañas persistentes serializan y releen la credencial dentro del lock', async () => {
  const temporaryA = createMemoryStorage()
  const temporaryB = createMemoryStorage()
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const idFactory = ids()
  const used = []
  const transport = { refresh: async (token) => {
    used.push(token)
    return tokenPair(used.length === 1 ? 'two' : 'three')
  } }
  const a = createSetup({ temporary: temporaryA, persistent, coordinator, idFactory, transport })
  await a.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const b = createSetup({ temporary: temporaryB, persistent, coordinator, idFactory, transport })
  await b.manager.restore()
  await Promise.all([a.manager.refresh(), b.manager.refresh()])
  assert.deepEqual(used, ['refresh-one', 'refresh-two'])
  assert.equal(persistent.entries().some(([, value]) => value.includes('refresh-three')), true)
})

test('bootstrap espera una rotación persistente y restaura el token nuevo', async () => {
  const waiting = deferred()
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const idFactory = ids()
  const first = createSetup({ persistent, coordinator, idFactory,
    transport: { refresh: async () => waiting.promise } })
  await first.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const later = createSetup({ persistent, coordinator, idFactory })
  const refreshing = first.manager.refresh()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const restoring = later.manager.restore()
  assert.equal(later.manager.getState().status, 'restoring')
  waiting.resolve(tokenPair('two'))
  await refreshing
  assert.equal((await restoring).status, 'pending_restore')
  assert.equal(later.storage.readCredentials().refreshToken, 'refresh-two')
})

test('copia temporal obsoleta no reenvía el refresh conocido como viejo', async () => {
  const temporaryA = createMemoryStorage()
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  let calls = 0
  const transport = { refresh: async () => { calls += 1; return tokenPair('two') } }
  const a = createSetup({ temporary: temporaryA, persistent, coordinator, transport })
  await a.manager.acceptTokens(tokenPair())
  const temporaryB = createMemoryStorage(Object.fromEntries(temporaryA.entries()))
  const b = createSetup({ temporary: temporaryB, persistent, coordinator, transport })
  await b.manager.restore()
  await a.manager.refresh()
  await assert.rejects(b.manager.refresh(), { code: 'refresh_state_uncertain' })
  assert.equal(calls, 1)
  assert.equal(b.manager.getState().status, 'recovery_required')
})

test('sin exclusión real no se envía refresh', async () => {
  let calls = 0
  let available = true
  const { manager } = createSetup({ coordinator: {
    runExclusive: async (_, operation) => {
      if (!available) throw new IamCoordinationError()
      return operation()
    },
  }, transport: { refresh: async () => { calls += 1; return tokenPair('two') } } })
  await manager.acceptTokens(tokenPair())
  available = false
  await assert.rejects(manager.refresh(), { message: 'coordination_unavailable' })
  assert.equal(calls, 0)
})

test('adaptador Web Locks usa exclusión real o informa capacidad ausente', async () => {
  const seen = []
  const coordinator = createWebLockCoordinator({ locks: { request: async (name, options, work) => {
    seen.push({ name, options })
    return work()
  } } })
  assert.equal(await coordinator.runExclusive('public-api-scope', async () => 7), 7)
  assert.deepEqual(seen, [{ name: 'public-api-scope', options: { mode: 'exclusive' } }])
  await assert.rejects(createWebLockCoordinator({ locks: {} })
    .runExclusive('scope', async () => 1), { code: 'coordination_unavailable' })
})

test('refresh tardío no resucita logout ni pisa login posterior', async () => {
  const waiting = deferred()
  const { manager } = createSetup({ transport: { refresh: async () => waiting.promise } })
  await manager.acceptTokens(tokenPair())
  const rotating = manager.refresh()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const closing = manager.logout()
  waiting.resolve(tokenPair('two'))
  await assert.rejects(rotating, { code: 'logout_in_progress' })
  assert.deepEqual(await closing, { revoked: true, localCleared: true })
  assert.equal(manager.getState().status, 'absent')

  const waitingAgain = deferred()
  const next = createSetup({ transport: { refresh: async () => waitingAgain.promise } })
  await next.manager.acceptTokens(tokenPair())
  const older = next.manager.refresh()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const newLogin = next.manager.acceptTokens(tokenPair('new-login'))
  waitingAgain.resolve(tokenPair('stale'))
  await assert.rejects(older, { code: 'context_changed' })
  await newLogin
  assert.equal(next.manager.getAccessToken(), 'access-new-login')
})

test('login de otra pestaña espera la rotación y queda como contexto final', async () => {
  const waiting = deferred()
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const idFactory = ids()
  const first = createSetup({ persistent, coordinator, idFactory,
    transport: { refresh: async () => waiting.promise } })
  await first.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const later = createSetup({ persistent, coordinator, idFactory })
  const refreshing = first.manager.refresh()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const login = later.manager.acceptTokens(tokenPair('later'), { rememberSession: true })
  waiting.resolve(tokenPair('rotated'))
  await refreshing
  await login
  assert.equal(later.storage.readCredentials().refreshToken, 'refresh-later')
  assert.equal(later.storage.readMarker().contextId, later.manager.getState().contextId)
})

test('logout de otra pestaña espera refresh y elimina su contexto', async () => {
  const waiting = deferred()
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const idFactory = ids()
  const used = []
  const transport = { refresh: async (token) => {
    used.push(token)
    return used.length === 1 ? waiting.promise : tokenPair('three')
  } }
  const first = createSetup({ persistent, coordinator, idFactory,
    transport })
  await first.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const second = createSetup({ persistent, coordinator, idFactory, transport })
  await second.manager.restore()
  const refreshing = first.manager.refresh()
  await new Promise((resolve) => setTimeout(resolve, 0))
  const logout = second.manager.logout()
  waiting.resolve(tokenPair('rotated'))
  await refreshing
  assert.deepEqual(await logout, { revoked: true, localCleared: true })
  assert.deepEqual(used, ['refresh-one', 'refresh-rotated'])
  assert.equal(persistent.entries().some(([key]) => key.endsWith(':refresh')), false)
  assert.equal(persistent.entries().some(([key]) => key.endsWith(':rotation')), false)
})

test('401 invalida; red y 5xx dejan resultado incierto sin reintento ciego', async () => {
  for (const [failure, expectedStatus, expectedCode] of [
    [new IamTransportError('rejected', 401), 'absent', 'refresh_rejected'],
    [new IamTransportError('network_error'), 'recovery_required', 'refresh_outcome_unknown'],
    [new IamTransportError('timeout'), 'recovery_required', 'refresh_outcome_unknown'],
    [new IamTransportError('server_error', 503), 'recovery_required', 'refresh_server_uncertain'],
  ]) {
    let calls = 0
    const { manager, storage } = createSetup({ transport: { refresh: async () => {
      calls += 1
      throw failure
    } } })
    await manager.acceptTokens(tokenPair())
    await assert.rejects(manager.refresh(), { code: expectedCode })
    assert.equal(manager.getState().status, expectedStatus)
    assert.equal(calls, 1)
    await assert.rejects(manager.refresh(), { code: 'no_refresh_credential' })
    assert.equal(calls, 1)
    if (expectedStatus === 'recovery_required') assert.equal(storage.readMarker().phase, 'inflight')
  }
})

test('respuesta inválida de refresh no publica credenciales parciales', async () => {
  const { manager, storage } = createSetup({ transport: { refresh: async () => ({
    accessToken: 'partial', tokenType: 'bearer', expiresIn: 60,
  }) } })
  await manager.acceptTokens(tokenPair())
  await assert.rejects(manager.refresh(), { code: 'invalid_refresh_response' })
  assert.equal(manager.getAccessToken(), null)
  assert.equal(storage.readCredentials().refreshToken, 'refresh-one')
  assert.equal(storage.readMarker().phase, 'inflight')
})

test('logout limpia local aun si falla la revocación remota', async () => {
  const { manager, storage } = createSetup({ transport: { logout: async () => {
    throw new IamTransportError('network_error')
  } } })
  await manager.acceptTokens(tokenPair())
  assert.deepEqual(await manager.logout(), { revoked: false, localCleared: true,
    reason: 'network_error' })
  assert.equal(storage.readCredentials(), null)
  assert.equal(manager.getState().status, 'absent')
})

test('logout antes del bootstrap elimina refresh guardado sin afirmar revocación', async () => {
  const temporary = createMemoryStorage()
  const persistent = createMemoryStorage()
  const first = createSetup({ temporary, persistent })
  await first.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const later = createSetup({ temporary, persistent })
  assert.equal(later.manager.getState().status, 'uninitialized')
  assert.deepEqual(await later.manager.logout(), { revoked: false, localCleared: true,
    reason: 'no_access_token' })
  assert.equal(later.storage.readCredentials(), null)
  assert.equal(later.storage.readMarker(), null)
})

test('logout cancela login anterior que esperaba el lock sin publicar sus tokens', async () => {
  const coordinator = createSerialCoordinator()
  const gate = deferred()
  const { manager, storage } = createSetup({ coordinator })
  const lockName = `mconnect-iam-rotation:${encodeURIComponent(storage.scope)}`
  const holding = coordinator.runExclusive(lockName, () => gate.promise)
  const pendingLogin = manager.acceptTokens(tokenPair())
  const closing = manager.logout()
  assert.equal(manager.getState().status, 'absent')
  gate.resolve()
  await holding
  await assert.rejects(pendingLogin, { code: 'context_changed' })
  assert.deepEqual(await closing, { revoked: false, localCleared: true,
    reason: 'no_access_token' })
  assert.equal(manager.getState().status, 'absent')
  assert.equal(storage.readCredentials(), null)
})

test('logout cancela restore anterior que esperaba el lock', async () => {
  const coordinator = createSerialCoordinator()
  const temporary = createMemoryStorage()
  const persistent = createMemoryStorage()
  const first = createSetup({ temporary, persistent, coordinator })
  await first.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const next = createSetup({ temporary, persistent, coordinator })
  const gate = deferred()
  const lockName = `mconnect-iam-rotation:${encodeURIComponent(next.storage.scope)}`
  const holding = coordinator.runExclusive(lockName, () => gate.promise)
  const restoring = next.manager.restore()
  const closing = next.manager.logout()
  gate.resolve()
  await holding
  await assert.rejects(restoring, { code: 'context_changed' })
  assert.deepEqual(await closing, { revoked: false, localCleared: true,
    reason: 'no_access_token' })
  assert.equal(next.manager.getState().status, 'absent')
  assert.equal(next.storage.readCredentials(), null)
})

test('logout distingue revocación remota de limpieza local fallida', async () => {
  let available = true
  const coordinator = { runExclusive: async (_, operation) => {
    if (!available) throw new IamCoordinationError()
    return operation()
  } }
  const { manager, storage } = createSetup({ coordinator })
  await manager.acceptTokens(tokenPair())
  available = false
  assert.deepEqual(await manager.logout(), { revoked: true, localCleared: false })
  assert.equal(manager.getState().status, 'absent')
  assert.equal(storage.readCredentials().refreshToken, 'refresh-one')
})

test('preflight acepta Web Locks y bloquea su ausencia antes de publicar tokens', async () => {
  const available = createWebLockCoordinator({ locks: {
    request: async (_, __, work) => work(),
  } })
  const supported = createSetup({ coordinator: available })
  assert.deepEqual(await supported.manager.checkCapabilities(), { available: true })
  await supported.manager.acceptTokens(tokenPair())
  assert.equal(supported.manager.getAccessToken(), 'access-one')

  const missing = createSetup({ coordinator: createWebLockCoordinator({ locks: {} }) })
  await assert.rejects(missing.manager.checkCapabilities(), (error) =>
    error instanceof IamCapabilityError && error.code === 'coordination_unavailable')
  await assert.rejects(missing.manager.acceptTokens(tokenPair()), {
    name: 'IamCapabilityError', code: 'coordination_unavailable',
  })
  assert.equal(missing.manager.getState().status, 'uninitialized')
  assert.equal(missing.storage.readCredentials(), null)
  assert.equal(missing.storage.readMarker(), null)

  const denied = createSetup({ coordinator: createWebLockCoordinator({ locks: {
    request: async () => { throw new Error('blocked by browser policy') },
  } }) })
  await assert.rejects(denied.manager.checkCapabilities(), {
    name: 'IamCapabilityError', code: 'coordination_unavailable',
  })
  await assert.rejects(denied.manager.acceptTokens(tokenPair()), {
    code: 'coordination_unavailable',
  })
  assert.equal(denied.manager.getAccessToken(), null)
  assert.equal(denied.storage.readCredentials(), null)
})

test('preflight distingue IDs seguros y almacenamiento inaccesibles', async () => {
  const insecure = createSetup({ secureContext: () => false })
  await assert.rejects(insecure.manager.checkCapabilities(), {
    name: 'IamCapabilityError', code: 'insecure_context',
  })
  await assert.rejects(insecure.manager.acceptTokens(tokenPair()), {
    code: 'insecure_context',
  })
  assert.equal(insecure.manager.getState().status, 'uninitialized')

  const storage = createIamStorage({ apiBaseUrl: base,
    temporaryStorage: createMemoryStorage(), persistentStorage: createMemoryStorage() })
  const manager = createIamSession({ storage, coordinator: createSerialCoordinator(),
    secureIdsAvailable: () => false,
    transport: { refresh: async () => tokenPair('two'), logout: async () => {} } })
  await assert.rejects(manager.checkCapabilities(), {
    name: 'IamCapabilityError', code: 'secure_id_unavailable',
  })
  await assert.rejects(manager.acceptTokens(tokenPair()), { code: 'secure_id_unavailable' })
  assert.equal(manager.getState().status, 'uninitialized')

  const blocked = { getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') },
    removeItem: () => { throw new Error('blocked') } }
  const unavailable = createSetup({ persistent: blocked })
  await assert.rejects(unavailable.manager.checkCapabilities(), {
    name: 'IamCapabilityError', code: 'storage_unavailable',
  })
  await assert.rejects(unavailable.manager.restore(), { code: 'storage_unavailable' })
  assert.equal(unavailable.manager.getState().status, 'uninitialized')
})

test('fallo al guardar la marca nunca publica un access parcial', async () => {
  const backing = createMemoryStorage()
  const persistent = { getItem: backing.getItem, removeItem: backing.removeItem,
    setItem: (key, value) => {
      if (key.endsWith(':rotation')) throw new Error('write blocked')
      backing.setItem(key, value)
    } }
  const { manager, storage } = createSetup({ persistent })
  await assert.rejects(manager.acceptTokens(tokenPair()), {
    name: 'IamCapabilityError', code: 'storage_unavailable',
  })
  assert.equal(manager.getAccessToken(), null)
  assert.equal(manager.getState().status, 'recovery_required')
  assert.equal(storage.readMarker(), null)
  assert.equal((await manager.restore()).status, 'recovery_required')
})

test('errores HTTP conservan detalle seguro, validaciones y origen', async () => {
  const failed = async (response, code = null) => {
    const api = { post: async () => {
      const error = new Error('request with secret')
      error.response = response
      error.code = code
      throw error
    }, get: async () => {} }
    return createIamTransport(api).login({ email: 'a@example.test', password: 'secret' })
      .then(() => assert.fail('Debía fallar'), (error) => error)
  }
  const business = await failed({ status: 400, data: { detail: 'Código incorrecto.' } })
  assert.equal(business.code, 'http_error')
  assert.equal(business.status, 400)
  assert.equal(business.detail, 'Código incorrecto.')
  assert.equal(business.source, 'detail')
  assert.equal(business.displayMessage, 'Código incorrecto.')

  const validation = await failed({ status: 422, data: { detail: [{
    loc: ['body', 'email'], msg: 'Email inválido', type: 'value_error',
    input: 'password-secret', ctx: { token: 'refresh-secret' },
  }] } })
  assert.equal(validation.status, 422)
  assert.equal(validation.source, 'validation')
  assert.deepEqual(validation.fieldErrors, [{ loc: ['body', 'email'],
    message: 'Email inválido', type: 'value_error' }])
  assert.equal(JSON.stringify(validation).includes('password-secret'), false)
  assert.equal(JSON.stringify(validation).includes('refresh-secret'), false)

  const limited = await failed({ status: 429, data: { error: 'Demasiados intentos.' } })
  assert.equal(limited.source, 'error')
  assert.equal(limited.detail, 'Demasiados intentos.')
  const rejected = await failed({ status: 401, data: { detail: 'Credenciales inválidas.' } })
  assert.equal(rejected.code, 'rejected')
  assert.equal(rejected.status, 401)
  const emptyBody = await failed({ status: 400, data: null })
  assert.equal(emptyBody.code, 'http_error')
  assert.equal(emptyBody.detail, null)
  assert.equal(emptyBody.source, 'none')
})

test('errores de red, timeout y 5xx no exponen cuerpos ni secretos', async () => {
  const fail = (response, code) => createIamTransport({ post: async () => {
    const error = new Error('password=secret')
    error.response = response
    error.code = code
    throw error
  }, get: async () => {} }).refresh('refresh-secret').then(
    () => assert.fail('Debía fallar'), (error) => error)
  assert.equal((await fail(undefined, undefined)).code, 'network_error')
  assert.equal((await fail(undefined, 'ECONNABORTED')).code, 'timeout')
  const server = await fail({ status: 503, data: {
    detail: 'Traceback: access_token=secret', password: 'secret',
  } })
  assert.equal(server.code, 'server_error')
  assert.equal(server.status, 503)
  assert.equal(server.detail, null)
  assert.equal(server.displayMessage.includes('Traceback'), false)
  assert.equal(JSON.stringify(server).includes('secret'), false)
  const sensitive = await fail({ status: 400, data: { detail: 'password: secret' } })
  assert.equal(sensitive.detail, null)
  assert.equal(sensitive.displayMessage, 'No se pudo completar la solicitud.')
})

test('detalles backend que reflejan el password u OTP enviados se ocultan', async () => {
  const api = { post: async (route) => {
    const error = new Error('secret request')
    error.response = { status: 400, data: { detail: route === '/auth/login'
      ? 'Valor mySecret! inválido' : 'El código 123456 es inválido' } }
    throw error
  }, get: async () => {} }
  const transport = createIamTransport(api)
  for (const operation of [
    transport.login({ email: 'a@example.test', password: 'mySecret!' }),
    transport.verifyOtp({ challengeId: 'challenge', code: '123456' }),
  ]) {
    const error = await operation.then(() => assert.fail('Debía fallar'), (value) => value)
    assert.equal(error.detail, null)
    assert.equal(JSON.stringify(error).includes('mySecret!'), false)
    assert.equal(JSON.stringify(error).includes('123456'), false)
  }
})

test('normalizador exportado sirve para recuperación sin implementar su UI', () => {
  const reset = normalizeIamError({ response: { status: 400,
    data: { detail: 'Código de recuperación inválido.' } } },
  { sensitiveValues: ['123456', 'new-password'] })
  assert.equal(reset.status, 400)
  assert.equal(reset.detail, 'Código de recuperación inválido.')
  const reflected = normalizeIamError({ response: { status: 400,
    data: { detail: 'El código 123456 es inválido.' } } },
  { sensitiveValues: ['123456'] })
  assert.equal(reflected.detail, null)
  const limited = normalizeIamError({ response: { status: 429,
    data: { error: 'Demasiados intentos.' } } })
  assert.equal(limited.detail, 'Demasiados intentos.')
})

test('/users/me exige el contrato serializado y conserva campos nullable', () => {
  const complete = { id: 'u', email: 'u@example.test', full_name: null,
    is_active: true, is_verified: false, last_login: null,
    tenant_id: null, role: null, platform_role: 'superadmin',
    created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-02T12:00:00Z',
    memberships: [], support_session: null }
  assert.deepEqual(normalizeCurrentUser(complete), complete)
  for (const key of Object.keys(complete)) {
    const missing = { ...complete }
    delete missing[key]
    assert.throws(() => normalizeCurrentUser(missing), { code: 'invalid_current_user' }, key)
  }
  for (const invalid of [
    { is_active: 'true' }, { is_verified: 1 }, { last_login: false },
    { created_at: null }, { updated_at: 123 }, { memberships: {} },
    { support_session: { id: 's' } }, { tenant_id: 1 }, { role: {} },
  ]) {
    assert.throws(() => normalizeCurrentUser({ ...complete, ...invalid }),
      { code: 'invalid_current_user' })
  }
  assert.throws(() => normalizeCurrentUser({ other: 'shape' }),
    { code: 'invalid_current_user' })
  assert.deepEqual(normalizeCurrentUser({ ...complete, last_login: '2026-10-08T12:00:00Z',
    memberships: [{ tenant_id: 't', tenant_name: '', role: 'viewer', status: 'active',
      tenant_is_active: false }] }).memberships[0].tenant_name, '')
})

test('storage events invalidan logout y nuevo contexto de otra pestaña', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const idFactory = ids()
  const events = createStorageEvents()
  const a = createSetup({ persistent, coordinator, idFactory })
  const b = createSetup({ persistent, coordinator, idFactory })
  await a.manager.acceptTokens(tokenPair(), { rememberSession: true })
  await b.manager.restore()
  a.manager.startSync(events)
  await b.manager.logout()
  events.dispatch({ key: persistent.entries().find(([key]) => key.endsWith(':rotation'))?.[0]
    ?? `${'mconnect:iam:v1:'}${encodeURIComponent(a.storage.scope)}:rotation`,
  storageArea: persistent })
  assert.equal(a.manager.getState().status, 'absent')
  assert.equal(a.manager.getAccessToken(), null)

  await a.manager.acceptTokens(tokenPair(), { rememberSession: true })
  await b.manager.acceptTokens(tokenPair('new'), { rememberSession: true })
  const [key, value] = persistent.entries().find(([name]) => name.endsWith(':rotation'))
  assert.equal(value.includes('refresh-new'), false)
  assert.equal(value.includes('access-new'), false)
  events.dispatch({ key, newValue: value, storageArea: persistent })
  assert.equal(a.manager.getState().status, 'absent')
  assert.equal(a.manager.getAccessToken(), null)
  a.manager.stopSync()
})

test('rotación normal conserva contexto y copia temporal vieja falla cerrado', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const idFactory = ids()
  const events = createStorageEvents()
  const a = createSetup({ persistent, coordinator, idFactory })
  await a.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const b = createSetup({ persistent, coordinator, idFactory })
  await b.manager.restore()
  b.manager.startSync(events)
  await a.manager.refresh()
  const [key, value] = persistent.entries().find(([name]) => name.endsWith(':rotation'))
  events.dispatch({ key, newValue: value, storageArea: persistent })
  assert.equal(b.manager.getState().status, 'pending_restore')
  assert.equal(await b.manager.refresh(), 'access-two')
  assert.equal(b.manager.getState().status, 'tokens_available')
  b.manager.stopSync()

  const temporary = createMemoryStorage()
  const marker = createMemoryStorage()
  const first = createSetup({ temporary, persistent: marker, coordinator, idFactory })
  await first.manager.acceptTokens(tokenPair())
  const cloned = createMemoryStorage(Object.fromEntries(temporary.entries()))
  const stale = createSetup({ temporary: cloned, persistent: marker, coordinator, idFactory })
  await stale.manager.restore()
  stale.manager.startSync(events)
  await first.manager.refresh()
  const [markerKey] = marker.entries().find(([name]) => name.endsWith(':rotation'))
  events.dispatch({ key: markerKey, storageArea: marker })
  assert.equal(stale.manager.getState().status, 'pending_restore')
  await assert.rejects(stale.manager.refresh(), { code: 'refresh_state_uncertain' })
  stale.manager.stopSync()
})

test('storage events ignoran duplicados e irrelevantes y listener se desmonta', async () => {
  const events = createStorageEvents()
  const { manager, storage, persistent } = createSetup()
  await manager.acceptTokens(tokenPair())
  const [key, value] = persistent.entries().find(([name]) => name.endsWith(':rotation'))
  const stop = manager.startSync(events)
  assert.equal(events.listenerCount(), 1)
  events.dispatch({ key: 'mconnect_session', storageArea: persistent })
  events.dispatch({ key, newValue: value, storageArea: persistent })
  events.dispatch({ key, newValue: value, storageArea: persistent })
  assert.equal(manager.getAccessToken(), 'access-one')
  stop()
  assert.equal(events.listenerCount(), 0)
  storage.clearContext(manager.getState().contextId)
  events.dispatch({ key, newValue: null, storageArea: persistent })
  assert.equal(manager.getAccessToken(), 'access-one')
})

test('suscripción entre pestañas informa ausencia de eventos de navegador', () => {
  const { manager } = createSetup()
  assert.throws(() => manager.startSync({}), {
    name: 'IamCapabilityError', code: 'context_events_unavailable',
  })
  assert.equal(manager.getState().status, 'uninitialized')
})
