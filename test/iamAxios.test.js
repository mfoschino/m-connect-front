import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { createServer } from 'vite'
import { installIamAxios } from '../src/services/auth/installIamAxios.js'
import { createIamTransport } from '../src/services/auth/iamTransport.js'
import { createIamSession } from '../src/services/auth/iamSession.js'
import { createIamStorage } from '../src/services/auth/iamStorage.js'
import { createMemoryStorage, createSerialCoordinator, createStorageEvents,
  deferred, tokenPair } from './iamFixtures.js'

const base = 'https://api.example.test'
const response = (config, status, data = null) => ({
  config, status, data, statusText: String(status), headers: {},
})
const rejectStatus = (config, status) => Promise.reject(new axios.AxiosError(
  `HTTP ${status}`, axios.AxiosError.ERR_BAD_RESPONSE, config, null, response(config, status),
))

const createManager = () => {
  let accessToken = 'access-one'
  let contextId = 'context-one'
  let generation = 1
  let revision = 1
  let status = 'tokens_available'
  let refreshCount = 0
  return {
    getAccessToken: () => accessToken,
    getState: () => ({ status }),
    getContextSnapshot: () => ({ contextId, generation, tokenRevision: revision }),
    isSameContext: (snapshot) => snapshot.contextId === contextId
      && snapshot.generation === generation,
    refresh: async () => {
      refreshCount += 1
      revision += 1
      accessToken = 'access-two'
      return accessToken
    },
    invalidateRejected: async (snapshot) => {
      if (snapshot.contextId !== contextId || snapshot.generation !== generation
        || snapshot.tokenRevision !== revision) return false
      accessToken = null
      status = 'absent'
      generation += 1
      return true
    },
    setAccessToken: (value) => { accessToken = value; status = value ? 'tokens_available' : 'absent' },
    replaceContext: () => { contextId = 'context-two'; generation += 1 },
    getRefreshCount: () => refreshCount,
  }
}

const rawPair = (suffix) => ({ access_token: `access-${suffix}`,
  refresh_token: `refresh-${suffix}`, token_type: 'bearer', expires_in: 60 })

const createIntegrated = (adapter, { temporary = createMemoryStorage(),
  persistent = createMemoryStorage(), coordinator = createSerialCoordinator() } = {}) => {
  let now = 1000
  let nextId = 0
  const client = axios.create({ baseURL: base, adapter })
  const storage = createIamStorage({ apiBaseUrl: base, temporaryStorage: temporary,
    persistentStorage: persistent })
  const manager = createIamSession({ transport: createIamTransport(client), storage, coordinator,
    clock: () => now, idFactory: () => `id-${++nextId}` })
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base })
  return { client, manager, storage, uninstall, setTime: (value) => { now = value } }
}

test('Axios opt-in usa Bearer actual y reintenta una sola vez preservando request', async () => {
  const seen = []
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    seen.push({ method: config.method, data: config.data, params: { ...config.params },
      authorization: config.headers.get('Authorization'),
      requestId: config.headers.get('X-Request-ID') })
    if (seen.length === 1) return rejectStatus(config, 401)
    return response(config, 200, { ok: true })
  } })
  const manager = createManager()
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base })
  const result = await client.post('/resource', { value: 4 }, {
    params: { page: 2 }, headers: { 'X-Request-ID': 'trace-one' },
  })
  assert.equal(result.data.ok, true)
  assert.equal(seen.length, 2)
  assert.deepEqual(seen.map((config) => config.method), ['post', 'post'])
  assert.deepEqual(seen.map((config) => JSON.parse(config.data)), [{ value: 4 }, { value: 4 }])
  assert.deepEqual(seen.map((config) => config.params), [{ page: 2 }, { page: 2 }])
  assert.equal(seen[0].authorization, 'Bearer access-one')
  assert.equal(seen[1].authorization, 'Bearer access-two')
  assert.equal(seen[1].requestId, 'trace-one')
  assert.equal(manager.getRefreshCount(), 1)
  uninstall()
})

test('opt-out explícito procesa 401 y refresh sin repetir POST ni DELETE', async () => {
  const seen = []
  const client = axios.create({ baseURL: base, adapter: (config) => {
    seen.push({ method: config.method, url: config.url,
      skip: config._iamSkipAuthRetry, headers: config.headers.toJSON(), data: config.data })
    return rejectStatus(config, 401)
  } })
  const manager = createManager()
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base })
  for (const request of [
    () => client.post('/resource', { value: 4 }, { _iamSkipAuthRetry: true }),
    () => client.delete('/resource', { _iamSkipAuthRetry: true }),
  ]) {
    const before = seen.length
    await assert.rejects(request(), (error) => error.response?.status === 401)
    assert.equal(seen.length, before + 1)
  }
  assert.equal(manager.getRefreshCount(), 2)
  assert.equal(manager.getState().status, 'tokens_available')
  assert.deepEqual(seen.map((item) => item.method), ['post', 'delete'])
  assert.equal(seen.every((item) => item.skip === true
    && !('_iamSkipAuthRetry' in item.headers)), true)
  assert.deepEqual(JSON.parse(seen[0].data), { value: 4 })
  uninstall()
})

test('opt-out conserva refresh preventivo y despacha una sola vez', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    return response(config, 201, { ok: true })
  })
  await setup.manager.acceptTokens(tokenPair())
  setup.setTime(61001)
  const result = await setup.client.post('/resource', { value: 4 },
    { _iamSkipAuthRetry: true })
  assert.equal(result.status, 201)
  assert.deepEqual(seen.map((item) => item.url), ['/auth/refresh', '/resource'])
  assert.equal(seen[1].bearer, 'Bearer access-two')
  setup.uninstall()
})

test('opt-out conserva invalidación de sesión cuando refresh recibe 401', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    return rejectStatus(config, 401)
  })
  await setup.manager.acceptTokens(tokenPair())
  await assert.rejects(setup.client.post('/resource', {},
    { _iamSkipAuthRetry: true }), { code: 'refresh_rejected' })
  assert.deepEqual(seen, ['/resource', '/auth/refresh'])
  assert.equal(setup.manager.getState().status, 'absent')
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('opt-out no despacha en otro contexto tras un refresh por 401 pendiente', async () => {
  const entered = deferred()
  const waiting = deferred()
  let calls = 0
  const client = axios.create({ baseURL: base, adapter: (config) => {
    calls += 1
    return rejectStatus(config, 401)
  } })
  const manager = createManager()
  manager.refresh = async () => { entered.resolve(); return waiting.promise }
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base })
  const pending = client.post('/resource', {}, { _iamSkipAuthRetry: true })
  await entered.promise
  manager.replaceContext()
  waiting.resolve('access-two')
  await assert.rejects(pending, { code: 'context_changed' })
  assert.equal(calls, 1)
  uninstall()
})

test('segundo 401 no produce loop de refresh', async () => {
  let calls = 0
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    calls += 1
    return rejectStatus(config, 401)
  } })
  const manager = createManager()
  installIamAxios(client, { manager, apiBaseUrl: base })
  await assert.rejects(client.get('/resource'), (error) => error.response?.status === 401)
  assert.equal(calls, 2)
  assert.equal(manager.getRefreshCount(), 1)
  assert.equal(manager.getState().status, 'absent')
})

test('login, OTP, reenvío y refresh no ingresan al ciclo automático', async () => {
  const seen = []
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    seen.push(config)
    return rejectStatus(config, 401)
  } })
  const manager = createManager()
  installIamAxios(client, { manager, apiBaseUrl: base })
  for (const route of ['/auth/login', '/auth/login/otp', '/auth/login/otp/resend', '/auth/refresh']) {
    await assert.rejects(client.post(route, {}), (error) => error.response?.status === 401)
  }
  assert.equal(seen.length, 4)
  assert.equal(seen.every((config) => !config.headers.get('Authorization')), true)
  assert.equal(manager.getRefreshCount(), 0)
})

test('rutas IAM públicas funcionan sin Bearer aun en recovery_required', async () => {
  const seen = []
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    return response(config, 200)
  } })
  let refreshCount = 0
  const manager = { getState: () => ({ status: 'recovery_required' }),
    getContextSnapshot: () => ({ contextId: 'old', generation: 1 }),
    getAccessToken: () => null,
    isSameContext: () => true,
    refresh: async () => { refreshCount += 1 } }
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base })
  const publicRoutes = ['/auth/forgot-password', '/auth/reset-password',
    '/auth/invitations/inspect', '/auth/invitations/accept', '/auth/register',
    '/auth/verify-email', '/auth/resend-verification']
  for (const route of publicRoutes) {
    await client.post(route, {}, { headers: { Authorization: 'Bearer accidental' } })
  }
  await client.get('/health')
  assert.equal(seen.length, publicRoutes.length + 1)
  assert.equal(seen.every((item) => item.bearer === undefined), true)
  assert.equal(refreshCount, 0)
  await assert.rejects(client.get('/users/me'), { code: 'no_refresh_credential' })
  assert.equal(seen.length, publicRoutes.length + 1)
  uninstall()
})

test('403 no invalida, y red/5xx no reintentan una escritura', async () => {
  for (const status of [403, 500, null]) {
    let calls = 0
    const client = axios.create({ baseURL: base, adapter: async (config) => {
      calls += 1
      if (status === null) throw new Error('offline')
      return rejectStatus(config, status)
    } })
    const manager = createManager()
    installIamAxios(client, { manager, apiBaseUrl: base })
    await assert.rejects(client.post('/resource', { write: true }))
    assert.equal(calls, 1)
    assert.equal(manager.getRefreshCount(), 0)
  }
})

test('otra renovación en la pestaña se aprovecha sin refresh redundante', async () => {
  const seen = []
  const manager = createManager()
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    seen.push(config.headers.get('Authorization'))
    if (seen.length === 1) {
      manager.setAccessToken('access-two')
      return rejectStatus(config, 401)
    }
    return response(config, 200)
  } })
  installIamAxios(client, { manager, apiBaseUrl: base })
  await client.get('/resource')
  assert.deepEqual(seen, ['Bearer access-one', 'Bearer access-two'])
  assert.equal(manager.getRefreshCount(), 0)
})

test('un 401 no reintenta la request bajo otro contexto', async () => {
  let calls = 0
  const manager = createManager()
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    calls += 1
    manager.replaceContext()
    return rejectStatus(config, 401)
  } })
  installIamAxios(client, { manager, apiBaseUrl: base })
  await assert.rejects(client.get('/resource'), { code: 'context_changed' })
  assert.equal(calls, 1)
  assert.equal(manager.getRefreshCount(), 0)
})

test('instancia opt-in no envía Bearer ni refresh a otro origen o prefijo', async () => {
  const seen = []
  const client = axios.create({ baseURL: `${base}/api`, adapter: async (config) => {
    seen.push(config)
    return rejectStatus(config, 401)
  } })
  const manager = createManager()
  installIamAxios(client, { manager, apiBaseUrl: `${base}/api` })
  for (const url of ['https://other.example.test/resource', `${base}/outside`]) {
    await assert.rejects(client.get(url), (error) => error.response?.status === 401)
  }
  assert.equal(seen.length, 2)
  assert.equal(seen.every((config) => !config.headers.get('Authorization')), true)
  assert.equal(manager.getRefreshCount(), 0)
})

test('sin access ni refresh el opt-in no despacha la request ni el Bearer anterior', async () => {
  let authorization
  let calls = 0
  const manager = createManager()
  manager.setAccessToken(null)
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    calls += 1
    authorization = config.headers.get('Authorization')
    return response(config, 200)
  } })
  installIamAxios(client, { manager, apiBaseUrl: base })
  await assert.rejects(client.get('/resource', { headers: { Authorization: 'Bearer legacy-access' } }),
    { code: 'no_refresh_credential' })
  assert.equal(calls, 0)
  assert.equal(authorization, undefined)
})

test('el cliente Axios activo no instala interceptor ni usa sesión legacy', async () => {
  const previousLocal = globalThis.localStorage
  const localStorage = new Map([['mconnect_session', JSON.stringify({ token: 'legacy-access' })]])
  globalThis.localStorage = { getItem: (key) => localStorage.get(key) ?? null }
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    server: { middlewareMode: true } })
  try {
    const active = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const requestCount = active.interceptors.request.handlers.filter(Boolean).length
    const responseCount = active.interceptors.response.handlers.filter(Boolean).length
    const result = await active.get('/legacy', { adapter: async (config) => response(config, 200,
      config.headers.get('Authorization')) })
    assert.equal(result.data, null)
    assert.equal(requestCount, 0)
    assert.equal(active.interceptors.request.handlers.filter(Boolean).length, requestCount)
    assert.equal(active.interceptors.response.handlers.filter(Boolean).length, responseCount)
  } finally {
    await vite.close()
    globalThis.localStorage = previousLocal
  }
})

test('gestor real: access vigente sale sin refresh; access vencido renueva antes del request', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    const bearer = config.headers.get('Authorization')
    seen.push({ url: config.url, bearer })
    if (config.url === '/auth/refresh') {
      assert.equal(JSON.parse(config.data).refresh_token, 'refresh-one')
      return response(config, 200, rawPair('two'))
    }
    if (!bearer) return rejectStatus(config, 403)
    return response(config, 200, { bearer })
  })
  await setup.manager.acceptTokens(tokenPair())
  assert.equal((await setup.client.get('/resource')).data.bearer, 'Bearer access-one')
  setup.setTime(61001)
  assert.equal((await setup.client.get('/resource')).data.bearer, 'Bearer access-two')
  assert.deepEqual(seen.map((item) => item.url), ['/resource', '/auth/refresh', '/resource'])
  assert.equal(setup.storage.readCredentials().refreshToken, 'refresh-two')
  setup.uninstall()
})

test('gestor real: requests simultáneas con access vencido comparten un refresh', async () => {
  const waiting = deferred()
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/auth/refresh') return waiting.promise.then(() => response(config, 200, rawPair('two')))
    if (!config.headers.get('Authorization')) return rejectStatus(config, 403)
    return response(config, 200)
  })
  await setup.manager.acceptTokens(tokenPair())
  setup.setTime(61001)
  const first = setup.client.get('/one')
  const second = setup.client.get('/two')
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(seen.map((item) => item.url), ['/auth/refresh'])
  waiting.resolve()
  await Promise.all([first, second])
  assert.equal(seen.filter((item) => item.url === '/auth/refresh').length, 1)
  assert.deepEqual(seen.filter((item) => item.url !== '/auth/refresh').map((item) => item.bearer),
    ['Bearer access-two', 'Bearer access-two'])
  setup.uninstall()
})

test('gestor real: refresh 401 deja sesión ausente sin despachar request protegida', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    if (config.url === '/auth/refresh') return rejectStatus(config, 401)
    return response(config, 200)
  })
  await setup.manager.acceptTokens(tokenPair())
  setup.setTime(61001)
  await assert.rejects(setup.client.get('/resource'), { code: 'refresh_rejected' })
  assert.deepEqual(seen, ['/auth/refresh'])
  assert.equal(setup.manager.getState().status, 'absent')
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: sin sesión renovable no envía una request protegida', async () => {
  let calls = 0
  const setup = createIntegrated(async (config) => {
    calls += 1
    return rejectStatus(config, 403)
  })
  await assert.rejects(setup.client.get('/resource'), { code: 'no_refresh_credential' })
  assert.equal(calls, 0)
  setup.uninstall()
})

test('gestor real: 403 de permisos no refresca ni invalida', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    return rejectStatus(config, 403)
  })
  await setup.manager.acceptTokens(tokenPair())
  await assert.rejects(setup.client.get('/resource'), (error) => error.response?.status === 403)
  assert.deepEqual(seen, ['/resource'])
  assert.equal(setup.manager.getState().status, 'tokens_available')
  setup.uninstall()
})

test('gestor real: 401, refresh y retry exitoso conservan método, body y params', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization'),
      method: config.method, body: config.data, params: config.params })
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    if (seen.filter((item) => item.url === '/resource').length === 1) return rejectStatus(config, 401)
    return response(config, 200, { ok: true })
  })
  await setup.manager.acceptTokens(tokenPair())
  assert.equal((await setup.client.post('/resource', { value: 4 }, { params: { page: 2 } })).data.ok, true)
  assert.deepEqual(seen.map((item) => item.url), ['/resource', '/auth/refresh', '/resource'])
  assert.equal(seen[2].bearer, 'Bearer access-two')
  assert.equal(seen[2].method, 'post')
  assert.deepEqual(JSON.parse(seen[2].body), { value: 4 })
  assert.deepEqual(seen[2].params, { page: 2 })
  setup.uninstall()
})

test('gestor real: segundo 401 invalida una sola vez y nunca hace tercer intento', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    return rejectStatus(config, 401)
  })
  await setup.manager.acceptTokens(tokenPair())
  await assert.rejects(setup.client.get('/resource'), (error) => error.response?.status === 401)
  assert.deepEqual(seen, ['/resource', '/auth/refresh', '/resource'])
  assert.equal(setup.manager.getState().status, 'absent')
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: segundo 401 tardío no borra un login posterior', async () => {
  const retryEntered = deferred()
  const releaseRetry = deferred()
  let protectedCalls = 0
  const setup = createIntegrated(async (config) => {
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    protectedCalls += 1
    if (protectedCalls === 1) return rejectStatus(config, 401)
    retryEntered.resolve()
    await releaseRetry.promise
    return rejectStatus(config, 401)
  })
  await setup.manager.acceptTokens(tokenPair())
  const old = setup.client.get('/resource')
  await retryEntered.promise
  await setup.manager.acceptTokens(tokenPair('new-login'))
  releaseRetry.resolve()
  await assert.rejects(old)
  assert.equal(protectedCalls, 2)
  assert.equal(setup.manager.getAccessToken(), 'access-new-login')
  assert.equal(setup.storage.readCredentials().refreshToken, 'refresh-new-login')
  setup.uninstall()
})

test('gestor real: retry no se despacha con Bearer de un login nuevo', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    return rejectStatus(config, 401)
  })
  setup.client.interceptors.request.use(async (config) => {
    if (config._iamRetried) await setup.manager.acceptTokens(tokenPair('new-login'))
    return config
  })
  await setup.manager.acceptTokens(tokenPair())
  await assert.rejects(setup.client.get('/resource'), { code: 'context_changed' })
  assert.deepEqual(seen.map((item) => item.url), ['/resource', '/auth/refresh'])
  assert.equal(setup.manager.getAccessToken(), 'access-new-login')
  setup.uninstall()
})

test('gestor real: retry redirigido fuera de la API no envía Bearer IAM', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    return rejectStatus(config, 401)
  })
  setup.client.interceptors.request.use((config) => {
    if (config._iamRetried) config.url = 'https://other.example.test/resource'
    return config
  })
  await setup.manager.acceptTokens(tokenPair())
  await assert.rejects(setup.client.get('/resource'), { code: 'unauthorized_api_scope' })
  assert.deepEqual(seen, ['/resource', '/auth/refresh'])
  setup.uninstall()
})

test('gestor real: segundo 401 de revisión vieja conserva renovación posterior local', async () => {
  const retryEntered = deferred()
  const releaseRetry = deferred()
  let protectedCalls = 0
  let rotations = 0
  const setup = createIntegrated(async (config) => {
    if (config.url === '/auth/refresh') {
      rotations += 1
      return response(config, 200, rawPair(rotations === 1 ? 'two' : 'three'))
    }
    protectedCalls += 1
    if (protectedCalls === 1) return rejectStatus(config, 401)
    retryEntered.resolve()
    await releaseRetry.promise
    return rejectStatus(config, 401)
  })
  await setup.manager.acceptTokens(tokenPair())
  const old = setup.client.get('/resource')
  await retryEntered.promise
  await setup.manager.refresh()
  releaseRetry.resolve()
  await assert.rejects(old)
  assert.equal(setup.manager.getAccessToken(), 'access-three')
  assert.equal(setup.storage.readCredentials().refreshToken, 'refresh-three')
  setup.uninstall()
})

test('gestor real: segundo 401 viejo no borra refresh más nuevo de otra pestaña', async () => {
  const retryEntered = deferred()
  const releaseRetry = deferred()
  const persistent = createMemoryStorage()
  const coordinator = createSerialCoordinator()
  let protectedCalls = 0
  const setup = createIntegrated(async (config) => {
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    protectedCalls += 1
    if (protectedCalls === 1) return rejectStatus(config, 401)
    retryEntered.resolve()
    await releaseRetry.promise
    return rejectStatus(config, 401)
  }, { persistent, coordinator })
  await setup.manager.acceptTokens(tokenPair(), { rememberSession: true })
  const otherStorage = createIamStorage({ apiBaseUrl: base,
    temporaryStorage: createMemoryStorage(), persistentStorage: persistent })
  let nextId = 0
  const other = createIamSession({ storage: otherStorage, coordinator,
    idFactory: () => `other-${++nextId}`, clock: () => 1000,
    transport: { refresh: async (token) => {
      assert.equal(token, 'refresh-two')
      return tokenPair('three')
    }, logout: async () => ({ revoked: true }) } })
  await other.restore()
  const old = setup.client.get('/resource')
  await retryEntered.promise
  await other.refresh()
  releaseRetry.resolve()
  await assert.rejects(old)
  assert.equal(setup.manager.getState().status, 'absent')
  assert.equal(persistent.entries().some(([, value]) => value.includes('refresh-three')), true)
  setup.uninstall()
})

test('gestor real: 200 de sesión vigente se entrega y 200 tardío de login previo se descarta', async () => {
  const entered = deferred()
  const release = deferred()
  let calls = 0
  const setup = createIntegrated(async (config) => {
    calls += 1
    if (calls === 1) return response(config, 200, { account: 'A' })
    entered.resolve()
    await release.promise
    return response(config, 200, { account: 'A-secret' })
  })
  await setup.manager.acceptTokens(tokenPair())
  assert.deepEqual((await setup.client.get('/resource')).data, { account: 'A' })
  let delivered = false
  const old = setup.client.get('/resource').then(() => { delivered = true })
  await entered.promise
  await setup.manager.acceptTokens(tokenPair('B'))
  release.resolve()
  await assert.rejects(old, { code: 'context_changed' })
  assert.equal(delivered, false)
  assert.equal(calls, 2)
  assert.equal(setup.manager.getAccessToken(), 'access-B')
  setup.uninstall()
})

test('gestor real: cambio de contexto de tenant descarta 200 antiguo sin retry', async () => {
  const entered = deferred()
  const release = deferred()
  let calls = 0
  const setup = createIntegrated(async (config) => {
    calls += 1
    entered.resolve()
    await release.promise
    return response(config, 200, { tenant: 'old' })
  })
  await setup.manager.acceptTokens(tokenPair())
  const old = setup.client.get('/tenant-data')
  await entered.promise
  await setup.manager.acceptTokens(tokenPair('tenant-B'))
  release.resolve()
  await assert.rejects(old, { code: 'context_changed' })
  assert.equal(calls, 1)
  assert.equal(setup.manager.getAccessToken(), 'access-tenant-B')
  setup.uninstall()
})

test('gestor real: refresh del mismo contexto no descarta un 200 válido en vuelo', async () => {
  const entered = deferred()
  const release = deferred()
  const setup = createIntegrated(async (config) => {
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    entered.resolve()
    await release.promise
    return response(config, 200, { ok: true })
  })
  await setup.manager.acceptTokens(tokenPair())
  const inFlight = setup.client.get('/resource')
  await entered.promise
  await setup.manager.refresh()
  release.resolve()
  assert.deepEqual((await inFlight).data, { ok: true })
  assert.equal(setup.manager.getAccessToken(), 'access-two')
  setup.uninstall()
})

test('gestor real: logout con access vigente envía Bearer pese al estado de cierre', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    assert.equal(config.url, '/auth/logout')
    return response(config, 204)
  })
  await setup.manager.acceptTokens(tokenPair())
  assert.deepEqual(await setup.manager.logout(), { revoked: true, localCleared: true })
  assert.deepEqual(seen, [{ url: '/auth/logout', bearer: 'Bearer access-one' }])
  assert.equal(setup.manager.getState().status, 'absent')
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: logout con access vencido renueva y revoca antes de limpiar', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    assert.equal(config.url, '/auth/logout')
    return response(config, 204)
  })
  await setup.manager.acceptTokens(tokenPair())
  setup.setTime(61001)
  assert.deepEqual(await setup.manager.logout(), { revoked: true, localCleared: true })
  assert.deepEqual(seen.map((item) => item.url), ['/auth/refresh', '/auth/logout'])
  assert.equal(seen[1].bearer, 'Bearer access-two')
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: logout desde pending_restore usa refresh y revoca', async () => {
  const temporary = createMemoryStorage()
  const persistent = createMemoryStorage()
  const first = createIntegrated(async (config) => response(config, 204), { temporary, persistent })
  await first.manager.acceptTokens(tokenPair(), { rememberSession: true })
  first.uninstall()
  const seen = []
  const restored = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/auth/refresh') return response(config, 200, rawPair('two'))
    return response(config, 204)
  }, { temporary, persistent })
  assert.equal((await restored.manager.restore()).status, 'pending_restore')
  assert.deepEqual(await restored.manager.logout(), { revoked: true, localCleared: true })
  assert.deepEqual(seen.map((item) => item.url), ['/auth/refresh', '/auth/logout'])
  assert.equal(seen[1].bearer, 'Bearer access-two')
  assert.equal(restored.storage.readCredentials(), null)
  restored.uninstall()
})

test('gestor real: refresh rechazado en logout limpia local sin afirmar revocación', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    return rejectStatus(config, 401)
  })
  await setup.manager.acceptTokens(tokenPair())
  setup.setTime(61001)
  assert.deepEqual(await setup.manager.logout(), { revoked: false, localCleared: true,
    reason: 'refresh_rejected' })
  assert.deepEqual(seen, ['/auth/refresh'])
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: refresh de resultado incierto no se reusa durante logout', async () => {
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push(config.url)
    throw new Error('offline')
  })
  await setup.manager.acceptTokens(tokenPair())
  setup.setTime(61001)
  assert.deepEqual(await setup.manager.logout(), { revoked: false, localCleared: true,
    reason: 'refresh_outcome_unknown' })
  assert.deepEqual(seen, ['/auth/refresh'])
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: fallo de red en logout conserva revoked false y limpia local', async () => {
  const setup = createIntegrated(async (config) => {
    assert.equal(config.url, '/auth/logout')
    throw new Error('offline')
  })
  await setup.manager.acceptTokens(tokenPair())
  assert.deepEqual(await setup.manager.logout(), { revoked: false, localCleared: true,
    reason: 'network_error' })
  assert.equal(setup.storage.readCredentials(), null)
  setup.uninstall()
})

test('gestor real: logout espera refresh en vuelo y no vuelve a publicar la sesión', async () => {
  const refreshEntered = deferred()
  const releaseRefresh = deferred()
  const seen = []
  const setup = createIntegrated(async (config) => {
    seen.push({ url: config.url, bearer: config.headers.get('Authorization') })
    if (config.url === '/auth/refresh') {
      refreshEntered.resolve()
      await releaseRefresh.promise
      return response(config, 200, rawPair('two'))
    }
    return response(config, 204)
  })
  await setup.manager.acceptTokens(tokenPair())
  const rotating = setup.manager.refresh()
  await refreshEntered.promise
  const closing = setup.manager.logout()
  assert.equal(setup.manager.getState().status, 'logging_out')
  assert.equal(setup.manager.getAccessToken(), null)
  await assert.rejects(setup.client.get('/resource'), { code: 'no_refresh_credential' })
  releaseRefresh.resolve()
  await assert.rejects(rotating, { code: 'logout_in_progress' })
  assert.deepEqual(await closing, { revoked: true, localCleared: true })
  assert.deepEqual(seen.map((item) => item.url), ['/auth/refresh', '/auth/logout'])
  assert.equal(seen[1].bearer, 'Bearer access-two')
  assert.equal(setup.manager.getState().status, 'absent')
  setup.uninstall()
})

test('gestor real: logout remoto tardío no borra un login posterior', async () => {
  const logoutEntered = deferred()
  const releaseLogout = deferred()
  const setup = createIntegrated(async (config) => {
    assert.equal(config.url, '/auth/logout')
    logoutEntered.resolve()
    await releaseLogout.promise
    return response(config, 204)
  })
  await setup.manager.acceptTokens(tokenPair())
  const oldLogout = setup.manager.logout()
  await logoutEntered.promise
  await setup.manager.acceptTokens(tokenPair('new-login'))
  releaseLogout.resolve()
  assert.deepEqual(await oldLogout, { revoked: true, localCleared: true })
  assert.equal(setup.manager.getAccessToken(), 'access-new-login')
  assert.equal(setup.storage.readCredentials().refreshToken, 'refresh-new-login')
  setup.uninstall()
})

test('gestor real: respuesta tardía se descarta tras logout en otra pestaña', async () => {
  const entered = deferred()
  const release = deferred()
  const persistent = createMemoryStorage()
  const events = createStorageEvents()
  const setup = createIntegrated(async (config) => {
    entered.resolve()
    await release.promise
    return response(config, 200, { private: true })
  }, { persistent })
  await setup.manager.acceptTokens(tokenPair(), { rememberSession: true })
  setup.manager.startSync(events)
  const [key] = persistent.entries().find(([name]) => name.endsWith(':rotation'))
  const old = setup.client.get('/private')
  await entered.promise
  setup.storage.clearContext(setup.manager.getState().contextId)
  events.dispatch({ key, newValue: null, storageArea: persistent })
  release.resolve()
  await assert.rejects(old, { code: 'context_changed' })
  assert.equal(setup.manager.getAccessToken(), null)
  assert.equal(setup.manager.getState().status, 'absent')
  setup.manager.stopSync()
  setup.uninstall()
})
