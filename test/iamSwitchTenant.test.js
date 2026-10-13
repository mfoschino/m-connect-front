import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers'
import axios from 'axios'
import { createIamTransport } from '../src/services/auth/iamTransport.js'
import { createIamSession } from '../src/services/auth/iamSession.js'
import { createIamStorage } from '../src/services/auth/iamStorage.js'
import { createIamAuthController } from '../src/services/auth/iamAuthController.js'
import { installIamAxios } from '../src/services/auth/installIamAxios.js'
import { routeDecision } from '../src/services/auth/iamRoutePolicy.js'
import { createMemoryStorage, createSerialCoordinator, createStorageEvents,
  deferred, tokenPair } from './iamFixtures.js'

const base = 'https://api.example.test'
const tenantA = 'tenant-a'
const tenantB = 'tenant-b'
const user = (tenantId) => ({ id: 'user', email: 'user@example.test', full_name: 'User',
  is_active: true, is_verified: true, last_login: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  tenant_id: tenantId, role: tenantId === tenantA ? 'admin' : 'viewer',
  platform_role: null, memberships: [
    { tenant_id: tenantA, tenant_name: 'A', role: 'admin', status: 'active', tenant_is_active: true },
    { tenant_id: tenantB, tenant_name: 'B', role: 'viewer', status: 'active', tenant_is_active: true },
  ], support_session: null })
const rawPair = (suffix) => ({ access_token: `access-${suffix}`,
  refresh_token: `refresh-${suffix}`, token_type: 'bearer', expires_in: 60 })
const response = (config, status, data = null) => ({ config, status, data,
  statusText: String(status), headers: {} })
const rejectStatus = (config, status) => Promise.reject(new axios.AxiosError(
  `HTTP ${status}`, axios.AxiosError.ERR_BAD_RESPONSE, config, null, response(config, status)))

const setup = ({ temporary = createMemoryStorage(), persistent = createMemoryStorage(),
  coordinator = createSerialCoordinator(), overrides = {}, idPrefix = 'id' } = {}) => {
  let now = 1000
  let nextId = 0
  const events = createStorageEvents()
  const calls = { switch: [], refresh: [], logout: [], profile: [] }
  const transport = {
    login: async () => ({ status: 'authenticated', ...tokenPair('old') }),
    refresh: async (refreshToken) => {
      calls.refresh.push(refreshToken)
      return tokenPair('refreshed')
    },
    switchTenant: async (tenantId, accessToken) => {
      calls.switch.push({ tenantId, accessToken })
      return tokenPair('new')
    },
    logout: async (accessToken) => { calls.logout.push(accessToken) },
    getCurrentUser: async (accessToken) => {
      calls.profile.push(accessToken)
      return user(accessToken === 'access-new' ? tenantB : tenantA)
    },
    ...overrides,
  }
  const storage = createIamStorage({ apiBaseUrl: base, temporaryStorage: temporary,
    persistentStorage: persistent })
  const manager = createIamSession({ storage, transport, coordinator,
    clock: () => now, idFactory: () => `${idPrefix}-${++nextId}` })
  const auth = createIamAuthController({ manager: { ...manager,
    startSync: () => manager.startSync(events) }, transport })
  return { auth, manager, storage, transport, calls, events, temporary, persistent,
    setTime: (value) => { now = value } }
}

const businessClient = (env, adapter) => {
  const calls = []
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    calls.push({ url: config.url, method: config.method,
      bearer: config.headers.get('Authorization') })
    return adapter ? adapter(config) : response(config, 200, { ok: true })
  } })
  const uninstall = installIamAxios(client, { manager: env.manager, apiBaseUrl: base,
    isBusinessReady: env.auth.isBusinessReady })
  return { client, calls, uninstall }
}

test('transporte envía tenant y Bearer aislados y valida el par', async () => {
  const calls = []
  const transport = createIamTransport({ post: async (...args) => {
    calls.push(args)
    return { data: rawPair('new') }
  }, get: async () => ({ data: user(tenantB) }) })
  assert.equal((await transport.switchTenant(tenantB, 'secret-access')).refreshToken, 'refresh-new')
  assert.deepEqual(calls[0][0], '/auth/switch-tenant')
  assert.deepEqual(calls[0][1], { tenant_id: tenantB })
  assert.equal(calls[0][2].headers.Authorization, 'Bearer secret-access')
})

test('switch crea frontera nueva y valida /users/me antes de publicar usuario', async () => {
  const network = deferred()
  const profile = deferred()
  const profileStarted = deferred()
  const env = setup({ overrides: {
    switchTenant: () => network.promise,
    getCurrentUser: (access) => {
      env.calls.profile.push(access)
      if (access === 'access-new') { profileStarted.resolve(); return profile.promise }
      return user(tenantA)
    },
  } })
  await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
  const before = env.manager.getContextSnapshot()
  const switching = env.auth.switchTenant(tenantB)
  assert.equal(env.auth.getState().status, 'switching')
  assert.equal(env.auth.getState().user, null)
  assert.equal(env.manager.getState().status, 'switching')
  assert.equal(env.manager.getAccessToken(), null)
  network.resolve(tokenPair('new'))
  await profileStarted.promise
  assert.equal(env.auth.getState().status, 'switching')
  assert.equal(env.manager.isSameContext(before), false)
  assert.equal(env.storage.readCredentials().refreshToken, 'refresh-new')
  profile.resolve(user(tenantB))
  await switching
  assert.equal(env.auth.getState().user.tenant_id, tenantB)
  assert.equal(env.auth.getState().user.role, 'viewer')
  assert.equal(env.auth.getState().status, 'authenticated')
})

test('Axios espera /users/me tras el 200: bloquea lecturas y escrituras privadas', async () => {
  const profile = deferred()
  const profileStarted = deferred()
  const oldResponse = deferred()
  const oldSent = deferred()
  const env = setup({ overrides: { getCurrentUser: (access) => {
    env.calls.profile.push(access)
    if (access === 'access-new') { profileStarted.resolve(); return profile.promise }
    return user(tenantA)
  } } })
  const { client, calls, uninstall } = businessClient(env, (config) => {
    if (config.url === '/old') {
      oldSent.resolve()
      return oldResponse.promise.then(() => response(config, 200, { old: true }))
    }
    return response(config, 200, { tenant: tenantB })
  })
  await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
  const old = client.get('/old')
  await oldSent.promise
  const switching = env.auth.switchTenant(tenantB)
  await profileStarted.promise
  assert.equal(env.manager.getState().status, 'tokens_available')
  assert.equal(env.auth.getState().status, 'switching')
  await assert.rejects(client.get('/integrations'), { code: 'authorization_pending' })
  await assert.rejects(client.post('/integrations', { name: 'No enviar' }),
    { code: 'authorization_pending' })
  await client.get('/health')
  assert.deepEqual(calls.map((call) => call.url), ['/old', '/health'])
  assert.equal(calls.at(-1).bearer, undefined)
  assert.deepEqual(env.calls.profile, ['access-old', 'access-new'])
  oldResponse.resolve()
  await assert.rejects(old, { code: 'context_changed' })
  profile.resolve(user(tenantB))
  await switching
  await client.get('/integrations')
  assert.equal(calls.at(-1).bearer, 'Bearer access-new')
  const profilesBeforeRefresh = env.calls.profile.length
  await env.manager.refresh()
  await client.get('/integrations')
  assert.equal(calls.at(-1).bearer, 'Bearer access-refreshed')
  assert.equal(env.calls.profile.length, profilesBeforeRefresh)
  uninstall()
})

test('fallo o tenant inesperado en /users/me mantienen cerrada la API privada', async () => {
  for (const problem of ['network', 'mismatch', '401']) {
    const env = setup({ overrides: { getCurrentUser: async (access) => {
      if (access === 'access-new' || access === 'access-refreshed') {
        if (problem === 'network') throw { code: 'network_error' }
        if (problem === '401') throw { status: 401 }
        return user(tenantA)
      }
      return user(tenantA)
    } } })
    const { client, calls, uninstall } = businessClient(env)
    await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
    await assert.rejects(env.auth.switchTenant(tenantB))
    assert.equal(env.auth.isBusinessReady(), false)
    await assert.rejects(client.get('/integrations'), { code: 'authorization_pending' })
    assert.deepEqual(calls, [])
    uninstall()
  }
})

test('403 sin rotación habilita el contexto anterior sólo después de revalidarlo', async () => {
  const profile = deferred()
  const profileStarted = deferred()
  let profiles = 0
  const env = setup({ overrides: {
    switchTenant: async () => { throw { status: 403 } },
    getCurrentUser: (access) => {
      profiles += 1
      if (profiles > 1) { profileStarted.resolve(); return profile.promise }
      return user(access === 'access-new' ? tenantB : tenantA)
    },
  } })
  const { client, calls, uninstall } = businessClient(env)
  await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
  const switching = env.auth.switchTenant(tenantB)
  await profileStarted.promise
  await assert.rejects(client.get('/integrations'), { code: 'authorization_pending' })
  assert.deepEqual(calls, [])
  profile.resolve(user(tenantA))
  await assert.rejects(switching, { status: 403 })
  await client.get('/integrations')
  assert.equal(calls[0].bearer, 'Bearer access-old')
  uninstall()
})

test('403 por acceso o suspensión conserva contexto y revalida membresías', async () => {
  for (const detail of ['Sin acceso', 'Organización suspendida']) {
    const env = setup({ overrides: { switchTenant: async () => {
      throw { status: 403, detail }
    } } })
    await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
    const before = env.manager.getContextSnapshot()
    await assert.rejects(env.auth.switchTenant(tenantB), { status: 403 })
    assert.equal(env.manager.isSameContext(before), true)
    assert.equal(env.manager.getAccessToken(), 'access-old')
    assert.equal(env.auth.getState().status, 'authenticated')
    assert.equal(env.auth.getState().user.tenant_id, tenantA)
    assert.equal(env.auth.getState().error.detail, detail)
    assert.deepEqual(env.calls.profile, ['access-old', 'access-old'])
  }
})

test('tenant inesperado y fallo de /users/me bloquean el contexto nuevo y permiten revalidar', async () => {
  for (const problem of ['mismatch', 'network']) {
    let fail = true
    const env = setup({ overrides: { getCurrentUser: async (access) => {
      if (access === 'access-new' && fail) {
        if (problem === 'network') throw { code: 'network_error' }
        return user(tenantA)
      }
      return user(access === 'access-new' ? tenantB : tenantA)
    } } })
    await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
    const before = env.manager.getContextSnapshot()
    await assert.rejects(env.auth.switchTenant(tenantB), problem === 'mismatch'
      ? { code: 'switch_tenant_mismatch' } : { code: 'network_error' })
    assert.equal(env.manager.isSameContext(before), false)
    assert.equal(env.auth.getState().status, 'unavailable')
    assert.equal(env.auth.getState().user, null)
    assert.equal(env.storage.readCredentials().refreshToken, 'refresh-new')
    fail = false
    await env.auth.retry()
    assert.equal(env.auth.getState().user.tenant_id, tenantB)
  }
})

test('red incierta y persistencia fallida no publican credenciales ni datos', async () => {
  const network = setup({ overrides: { switchTenant: async () => {
    throw { code: 'network_error' }
  } } })
  await network.manager.acceptTokens(tokenPair('old'))
  await assert.rejects(network.manager.switchTenant(tenantB),
    { code: 'switch_outcome_unknown' })
  assert.equal(network.manager.getState().status, 'recovery_required')
  assert.equal(network.manager.getAccessToken(), null)
  assert.equal(network.storage.readMarker().phase, 'inflight')
  assert.deepEqual(network.calls.refresh, [])

  const actual = createMemoryStorage()
  const failing = { ...actual, setItem: (key, value) => {
    if (String(value).includes('refresh-new')) throw new Error('disk failure')
    actual.setItem(key, value)
  } }
  const commit = setup({ temporary: failing })
  await commit.manager.acceptTokens(tokenPair('old'))
  await assert.rejects(commit.manager.switchTenant(tenantB),
    { code: 'switch_commit_uncertain' })
  assert.equal(commit.manager.getState().status, 'recovery_required')
  assert.equal(commit.manager.getAccessToken(), null)
  assert.notEqual(commit.storage.readCredentials()?.refreshToken, 'refresh-new')
})

test('5xx y par inválido conservan el resultado como incierto', async () => {
  for (const [failure, code] of [
    [{ code: 'server_error', status: 503 }, 'switch_server_uncertain'],
    [null, 'invalid_switch_response'],
  ]) {
    const env = setup({ overrides: { switchTenant: async () => {
      if (failure) throw failure
      return { accessToken: 'incomplete' }
    } } })
    await env.manager.acceptTokens(tokenPair('old'))
    await assert.rejects(env.manager.switchTenant(tenantB), { code })
    assert.equal(env.manager.getState().status, 'recovery_required')
    assert.equal(env.manager.getAccessToken(), null)
    assert.equal(env.storage.readMarker().phase, 'inflight')
  }
})

test('401 renueva una vez fuera del lock; 401 repetido limpia la sesión', async () => {
  let attempts = 0
  const recovered = setup({ overrides: { switchTenant: async () => {
    attempts += 1
    if (attempts === 1) throw { status: 401 }
    return tokenPair('new')
  } } })
  await recovered.manager.acceptTokens(tokenPair('old'))
  await recovered.manager.switchTenant(tenantB)
  assert.equal(attempts, 2)
  assert.deepEqual(recovered.calls.refresh, ['refresh-old'])
  assert.equal(recovered.storage.readCredentials().refreshToken, 'refresh-new')

  const rejected = setup({ overrides: { switchTenant: async () => {
    throw { status: 401 }
  } } })
  await rejected.manager.acceptTokens(tokenPair('old'))
  await assert.rejects(rejected.manager.switchTenant(tenantB), { status: 401 })
  assert.equal(rejected.manager.getState().status, 'absent')
  assert.equal(rejected.storage.readCredentials(), null)
})

test('refresh previo se serializa; switch con access vencido reutiliza refresh existente', async () => {
  const refresh = deferred()
  const started = deferred()
  const env = setup({ overrides: { refresh: async (token) => {
    env.calls.refresh.push(token)
    started.resolve()
    return refresh.promise
  } } })
  await env.manager.acceptTokens(tokenPair('old'))
  env.setTime(62000)
  const renewal = env.manager.refresh()
  await started.promise
  const switching = env.manager.switchTenant(tenantB)
  assert.equal(env.manager.getState().status, 'switching')
  assert.deepEqual(env.calls.switch, [])
  refresh.resolve(tokenPair('refreshed'))
  await renewal
  await switching
  assert.deepEqual(env.calls.refresh, ['refresh-old'])
  assert.deepEqual(env.calls.switch, [{ tenantId: tenantB, accessToken: 'access-refreshed' }])
})

test('access vencido se renueva antes del switch y refresh normal conserva frontera', async () => {
  const env = setup()
  await env.manager.acceptTokens(tokenPair('old'))
  const before = env.manager.getContextSnapshot()
  env.setTime(62000)
  await env.manager.switchTenant(tenantB)
  assert.deepEqual(env.calls.refresh, ['refresh-old'])
  assert.deepEqual(env.calls.switch, [{ tenantId: tenantB, accessToken: 'access-refreshed' }])
  assert.equal(env.manager.isSameContext(before), false)

  const sameTenant = setup()
  await sameTenant.manager.acceptTokens(tokenPair('old'))
  const context = sameTenant.manager.getContextSnapshot()
  await sameTenant.manager.refresh()
  assert.equal(sameTenant.manager.isSameContext(context), true)
})

test('dos switches simultáneos no se pisan; logout durante switch revoca el mismo sid', async () => {
  const pending = deferred()
  const started = deferred()
  const env = setup({ overrides: { switchTenant: async () => {
    started.resolve()
    return pending.promise
  } } })
  await env.manager.acceptTokens(tokenPair('old'))
  const first = env.manager.switchTenant(tenantB)
  await started.promise
  await assert.rejects(env.manager.switchTenant('tenant-c'), { code: 'switch_in_progress' })
  await assert.rejects(env.manager.switchTenant(tenantB), { code: 'switch_in_progress' })
  const closing = env.manager.logout()
  pending.resolve(tokenPair('new'))
  await assert.rejects(first, { code: 'context_changed' })
  await closing
  assert.equal(env.manager.getState().status, 'absent')
  assert.equal(env.storage.readCredentials(), null)
  assert.deepEqual(env.calls.logout, ['access-old'])
})

test('registro IAM anterior sin linaje conserva su identidad al refrescar y cambiar tenant', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const original = setup({ persistent, coordinator, idPrefix: 'original' })
  await original.manager.acceptTokens(tokenPair('old'), { rememberSession: true })
  const initial = original.manager.getState().contextId
  for (const [key, raw] of persistent.entries()) {
    const value = JSON.parse(raw)
    delete value.lineageId
    persistent.setItem(key, JSON.stringify(value))
  }
  const restored = setup({ persistent, coordinator, idPrefix: 'restored' })
  await restored.manager.restore()
  await restored.manager.refresh()
  assert.equal(restored.storage.readCredentials().lineageId, initial)
  await restored.manager.switchTenant(tenantB)
  assert.notEqual(restored.manager.getState().contextId, initial)
  assert.equal(restored.storage.readCredentials().lineageId, initial)
  assert.equal(restored.storage.readMarker().lineageId, initial)
})

test('login nuevo durante switch descarta el par viejo y conserva el nuevo', async () => {
  const pending = deferred()
  const started = deferred()
  const env = setup({ overrides: { switchTenant: async () => {
    started.resolve()
    return pending.promise
  } } })
  await env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
  const switching = env.auth.switchTenant(tenantB)
  await started.promise
  const login = env.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
  pending.resolve(tokenPair('new'))
  await assert.rejects(switching, { code: 'context_changed' })
  await login
  assert.equal(env.auth.getState().status, 'authenticated')
  assert.equal(env.auth.getState().user.tenant_id, tenantA)
  assert.equal(env.storage.readCredentials().refreshToken, 'refresh-old')
})

test('Axios bloquea privadas durante switching y descarta 200, 401 y retries viejos', async () => {
  const pending = deferred()
  const sent = deferred()
  const old200 = deferred()
  const old401 = deferred()
  const seen = []
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/old-200') return old200.promise.then(() => response(config, 200, { old: true }))
    if (config.url === '/old-401') {
      sent.resolve()
      return old401.promise.then(() => rejectStatus(config, 401))
    }
    return response(config, 200, {})
  } })
  const env = setup({ overrides: { switchTenant: () => pending.promise } })
  await env.manager.acceptTokens(tokenPair('old'))
  const uninstall = installIamAxios(client, { manager: env.manager, apiBaseUrl: base })
  const first = client.get('/old-200')
  const second = client.get('/old-401')
  await sent.promise
  const switching = env.manager.switchTenant(tenantB)
  await assert.rejects(client.get('/private'), { code: 'switch_in_progress' })
  await client.post('/auth/forgot-password', { email: 'user@example.test' })
  pending.resolve(tokenPair('new'))
  await switching
  old200.resolve()
  old401.resolve()
  await assert.rejects(first, { code: 'context_changed' })
  await assert.rejects(second, { code: 'context_changed' })
  assert.deepEqual(seen.map((item) => item.url), ['/old-200', '/old-401',
    '/auth/forgot-password'])
  assert.equal(seen[2].bearer, undefined)
  uninstall()
})

test('otra pestaña refresca antes del switch y la revisión persistente se relee', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const first = setup({ persistent, coordinator })
  const second = setup({ persistent, coordinator })
  await first.manager.acceptTokens(tokenPair('old'), { rememberSession: true })
  await second.manager.restore()
  await second.manager.refresh()
  const oldContext = first.manager.getContextSnapshot()
  await first.manager.switchTenant(tenantB)
  assert.equal(first.manager.isSameContext(oldContext), false)
  assert.equal(first.storage.readCredentials().refreshToken, 'refresh-new')
  assert.deepEqual(first.calls.switch, [{ tenantId: tenantB, accessToken: 'access-old' }])
})

test('switch remoto invalida pestaña persistente y copia temporal obsoleta falla cerrado', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const first = setup({ persistent, coordinator })
  const second = setup({ persistent, coordinator })
  await first.manager.acceptTokens(tokenPair('old'), { rememberSession: true })
  await second.manager.restore()
  await second.manager.refresh()
  second.manager.startSync(second.events)
  const before = second.manager.getContextSnapshot()
  await first.manager.switchTenant(tenantB)
  second.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(first.storage.scope)}:rotation`,
    storageArea: persistent })
  assert.equal(second.manager.getState().status, 'remote_switch')
  assert.equal(second.manager.isSameContext(before), false)
  assert.equal(second.manager.getAccessToken(), null)
  await second.manager.restore()
  assert.equal(second.manager.getState().status, 'pending_restore')
  await second.manager.refresh()
  assert.equal(second.manager.getState().contextId, first.manager.getState().contextId)

  const sharedMarker = createMemoryStorage()
  const tabA = setup({ persistent: sharedMarker })
  await tabA.manager.acceptTokens(tokenPair('old'))
  const tabBStorage = createMemoryStorage(Object.fromEntries(tabA.temporary.entries()))
  const tabB = setup({ temporary: tabBStorage, persistent: sharedMarker })
  await tabB.manager.restore()
  tabB.manager.startSync(tabB.events)
  await tabA.manager.switchTenant(tenantB)
  tabB.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(tabA.storage.scope)}:rotation`,
    storageArea: sharedMarker })
  assert.equal(tabB.manager.getState().status, 'remote_switch')
  await tabB.manager.restore()
  assert.equal(tabB.manager.getState().status, 'recovery_required')
  assert.deepEqual(tabB.calls.refresh, [])
})

test('controlador reconcilia switch remoto persistente y valida /users/me nuevo', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const first = setup({ persistent, coordinator })
  const second = setup({ persistent, coordinator, overrides: {
    refresh: async (token) => tokenPair(token === 'refresh-new' ? 'new' : 'refreshed'),
  } })
  await first.manager.acceptTokens(tokenPair('old'), { rememberSession: true })
  await second.auth.bootstrap()
  assert.equal(second.auth.getState().user.tenant_id, tenantA)
  const reconciled = new Promise((resolve) => {
    const unsubscribe = second.auth.subscribe(() => {
      if (second.auth.getState().user?.tenant_id === tenantB) {
        unsubscribe()
        resolve()
      }
    })
  })
  await first.manager.switchTenant(tenantB)
  second.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(first.storage.scope)}:rotation`,
    storageArea: persistent })
  assert.equal(second.auth.getState().user, null)
  await reconciled
  assert.equal(second.auth.getState().status, 'authenticated')
  assert.equal(second.auth.getState().user.role, 'viewer')
})

test('logout espera switch remoto, limpia el mismo linaje y no se reautentica', async () => {
  const baseStorage = createMemoryStorage()
  let first
  let eventDuringLogout = 0
  const persistent = { ...baseStorage, setItem: (key, value) => {
    baseStorage.setItem(key, value)
    const marker = key.endsWith(':rotation') ? JSON.parse(value) : null
    if (marker?.phase === 'ready' && marker.transition === 'tenant_switch') {
      eventDuringLogout += 1
      first.events.dispatch({ key, storageArea: persistent })
    }
  } }
  const coordinator = createSerialCoordinator()
  const switchResult = deferred()
  const switchStarted = deferred()
  first = setup({ persistent, coordinator, idPrefix: 'first' })
  const second = setup({ persistent, coordinator, idPrefix: 'second', overrides: {
    switchTenant: async () => { switchStarted.resolve(); return switchResult.promise },
  } })
  await first.auth.beginLogin({ email: 'user@example.test', password: 'secret',
    rememberSession: true })
  assert.equal(first.storage.readCredentials().lineageId,
    first.manager.getState().contextId)
  await second.auth.bootstrap()
  const switching = second.auth.switchTenant(tenantB)
  await switchStarted.promise
  const closing = first.auth.logout()
  assert.equal(first.auth.getState().status, 'anonymous')
  switchResult.resolve(tokenPair('new'))
  await Promise.allSettled([switching, closing])
  const outcome = await closing
  assert.deepEqual(outcome, { revoked: true, localCleared: true })
  assert.equal(eventDuringLogout, 1)
  assert.equal(first.storage.readCredentials(), null)
  assert.equal(first.storage.readMarker(), null)
  assert.equal(first.auth.getState().status, 'anonymous')
  assert.deepEqual(first.calls.profile, ['access-old'])
  assert.equal(first.calls.logout.length, 1)
  second.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(first.storage.scope)}:rotation`,
    storageArea: persistent })
  assert.equal(second.manager.getAccessToken(), null)
  assert.notEqual(second.auth.getState().status, 'authenticated')
})

test('logout toma el lock primero y un switch remoto no llega al servidor', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const logoutEntered = deferred()
  const remote = deferred()
  const first = setup({ persistent, coordinator, idPrefix: 'first', overrides: {
    logout: async (token) => {
      first.calls.logout.push(token)
      logoutEntered.resolve()
      return remote.promise
    },
  } })
  const second = setup({ persistent, coordinator, idPrefix: 'second' })
  await first.manager.acceptTokens(tokenPair('old'), { rememberSession: true })
  await second.manager.restore()
  await second.manager.refresh()
  const closing = first.manager.logout()
  await logoutEntered.promise
  await assert.rejects(second.manager.switchTenant(tenantB),
    { code: 'switch_state_uncertain' })
  assert.deepEqual(second.calls.switch, [])
  assert.equal(first.storage.readCredentials(), null)
  remote.resolve()
  assert.deepEqual(await closing, { revoked: true, localCleared: true })
  second.manager.startSync(second.events)
  second.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(first.storage.scope)}:rotation`,
    storageArea: persistent })
  assert.equal(second.manager.getAccessToken(), null)
})

const failedCloseScenario = async ({ persistentFailure = false } = {}) => {
  const actual = createMemoryStorage()
  let closeFailures = persistentFailure ? Infinity : 1
  const persistent = { ...actual, setItem: (key, value) => {
    if (key.endsWith(':rotation') && JSON.parse(value).attemptId === 'closed'
      && closeFailures > 0) {
      closeFailures -= 1
      throw new Error('falló la escritura de la marca cerrada')
    }
    actual.setItem(key, value)
  } }
  const coordinator = createSerialCoordinator()
  const remote = deferred()
  const entered = deferred()
  let sessionRevoked = false
  const first = setup({ persistent, coordinator, idPrefix: 'first', overrides: {
    logout: async (token) => {
      first.calls.logout.push(token)
      entered.resolve()
      await remote.promise
      sessionRevoked = true
    },
  } })
  const second = setup({ persistent, coordinator, idPrefix: 'second', overrides: {
    refresh: async (token) => {
      second.calls.refresh.push(token)
      if (sessionRevoked) throw { status: 401 }
      return tokenPair('refreshed')
    },
    switchTenant: async (tenantId, accessToken) => {
      second.calls.switch.push({ tenantId, accessToken })
      if (sessionRevoked) throw { status: 401 }
      return tokenPair('new')
    },
  } })
  await first.auth.beginLogin({ email: 'user@example.test', password: 'secret',
    rememberSession: true })
  await second.auth.bootstrap()
  return { first, second, remote, entered, persistent }
}

test('fallo inicial de marca: logout mantiene lock hasta revocar y limpiar', async () => {
  const { first, second, remote, entered, persistent } = await failedCloseScenario()
  const originalLineage = first.storage.readCredentials().lineageId
  const closing = first.auth.logout()
  await entered.promise
  assert.equal(first.storage.readMarker().phase, 'ready')
  const switching = second.manager.switchTenant(tenantB)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(second.calls.switch, [])
  assert.equal(second.storage.readCredentials().lineageId, originalLineage)
  assert.equal(first.auth.getState().status, 'anonymous')
  assert.deepEqual(first.calls.profile, ['access-old'])
  remote.resolve()
  assert.deepEqual(await closing, { revoked: true, localCleared: true })
  await assert.rejects(switching, { code: 'switch_state_uncertain' })
  assert.equal(first.storage.readCredentials(), null)
  assert.equal(first.storage.readMarker(), null)
  second.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(first.storage.scope)}:rotation`,
    storageArea: persistent })
  assert.equal(second.manager.getAccessToken(), null)
  assert.equal(first.auth.getState().status, 'anonymous')
})

test('fallo inicial de marca: red y timeout liberan lock tras limpiar', async () => {
  for (const code of ['network_error', 'timeout']) {
    const { first, second, remote, entered } = await failedCloseScenario()
    const closing = first.auth.logout()
    await entered.promise
    const switching = second.manager.switchTenant(tenantB)
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(second.calls.switch, [])
    remote.reject({ code })
    assert.deepEqual(await closing, { revoked: false, localCleared: true, reason: code })
    await assert.rejects(switching, { code: 'switch_state_uncertain' })
    assert.equal(first.storage.readCredentials(), null)
    assert.equal(first.auth.getState().status, 'anonymous')
  }
})

test('fallo persistente de Storage: 204 revoca sin afirmar limpieza local', async () => {
  const { first, second, remote, entered } = await failedCloseScenario({
    persistentFailure: true,
  })
  const closing = first.auth.logout()
  await entered.promise
  const switching = second.manager.switchTenant(tenantB)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(second.calls.switch, [])
  remote.resolve()
  assert.deepEqual(await closing, { revoked: true, localCleared: false })
  await assert.rejects(switching, { code: 'refresh_rejected' })
  assert.equal(second.manager.getAccessToken(), null)
  assert.equal(first.auth.getState().status, 'recovery_required')
  assert.equal(first.auth.getState().user, null)
})

test('Storage y revocación fallidos no prometen cierre entre pestañas', async () => {
  const { first, second, remote, entered } = await failedCloseScenario({
    persistentFailure: true,
  })
  const lineage = first.storage.readCredentials().lineageId
  const closing = first.auth.logout()
  await entered.promise
  const switching = second.manager.switchTenant(tenantB)
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(second.calls.switch, [])
  remote.reject({ code: 'network_error' })
  assert.deepEqual(await closing,
    { revoked: false, localCleared: false, reason: 'network_error' })
  await switching
  assert.equal(second.storage.readCredentials().lineageId, lineage)
  assert.equal(first.auth.getState().status, 'recovery_required')
})

test('fallo inicial de marca no borra un login independiente posterior', async () => {
  const { first, second, remote, entered } = await failedCloseScenario()
  const oldLineage = first.storage.readCredentials().lineageId
  const closing = first.auth.logout()
  await entered.promise
  const login = second.manager.acceptTokens(tokenPair('new-login'),
    { rememberSession: true })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(first.storage.readCredentials().lineageId, oldLineage)
  remote.resolve()
  assert.deepEqual(await closing, { revoked: true, localCleared: true })
  await login
  assert.notEqual(second.storage.readCredentials().lineageId, oldLineage)
  assert.equal(second.storage.readCredentials().refreshToken, 'refresh-new-login')
  assert.equal(first.auth.getState().status, 'anonymous')
})

test('logout viejo no borra login independiente mientras espera respuesta remota', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const remote = deferred()
  const entered = deferred()
  const first = setup({ persistent, coordinator, idPrefix: 'first', overrides: {
    logout: async () => { entered.resolve(); return remote.promise },
  } })
  const second = setup({ persistent, coordinator, idPrefix: 'second' })
  await first.auth.beginLogin({ email: 'user@example.test', password: 'secret',
    rememberSession: true })
  const originalLineage = first.storage.readCredentials().lineageId
  const closing = first.auth.logout()
  await entered.promise
  await second.manager.acceptTokens(tokenPair('new-login'), { rememberSession: true })
  const later = second.storage.readCredentials()
  assert.notEqual(later.lineageId, originalLineage)
  remote.resolve()
  assert.deepEqual(await closing, { revoked: true, localCleared: true })
  assert.equal(second.storage.readCredentials().refreshToken, 'refresh-new-login')
  assert.equal(first.auth.getState().status, 'anonymous')
})

test('logout de una copia temporal deja inutilizable el refresh remoto obsoleto', async () => {
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  const first = setup({ persistent, coordinator, idPrefix: 'first' })
  await first.manager.acceptTokens(tokenPair('old'))
  const clone = createMemoryStorage(Object.fromEntries(first.temporary.entries()))
  const second = setup({ temporary: clone, persistent, coordinator, idPrefix: 'second' })
  await second.manager.restore()
  await second.manager.refresh()
  await second.manager.switchTenant(tenantB)
  const outcome = await first.manager.logout()
  assert.deepEqual(outcome, { revoked: true, localCleared: true })
  assert.equal(first.storage.readMarker(), null)
  second.manager.startSync(second.events)
  second.events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(first.storage.scope)}:rotation`,
    storageArea: persistent })
  await second.manager.restore()
  assert.equal(second.manager.getState().status, 'recovery_required')
  assert.deepEqual(second.calls.refresh, ['refresh-old'])
})

test('logout distingue fallo remoto y fallo de Storage sin republicar usuario', async () => {
  const network = setup({ overrides: { logout: async () => {
    throw { code: 'network_error' }
  } } })
  await network.auth.beginLogin({ email: 'user@example.test', password: 'secret' })
  assert.deepEqual(await network.auth.logout(),
    { revoked: false, localCleared: true, reason: 'network_error' })
  assert.equal(network.auth.getState().status, 'anonymous')
  assert.equal(network.storage.readCredentials(), null)

  const actual = createMemoryStorage()
  const failing = { ...actual, removeItem: (key) => {
    if (key.endsWith(':rotation')) throw new Error('disk failure')
    actual.removeItem(key)
  } }
  const storage = setup({ persistent: failing })
  await storage.auth.beginLogin({ email: 'user@example.test', password: 'secret',
    rememberSession: true })
  assert.deepEqual(await storage.auth.logout(), { revoked: true, localCleared: false })
  assert.equal(storage.auth.getState().status, 'recovery_required')
  assert.equal(storage.auth.getState().user, null)
})

test('rutas privadas bloquean switching; la política pública no depende de ProtectedRoute', () => {
  assert.equal(routeDecision({ status: 'switching', user: null }), 'loading')
  assert.equal(routeDecision({ status: 'recovery_required', user: null }), 'error')
  assert.equal(routeDecision({ status: 'authenticated', user: user(null) }), 'no_tenant')
  assert.equal(routeDecision({ status: 'authenticated', user: { ...user(tenantA),
    tenant_id: null, role: null, platform_role: 'superadmin' } }), 'no_tenant')
})
