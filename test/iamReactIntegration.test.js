import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'
import axios from 'axios'
import { readFile } from 'node:fs/promises'
import { createIamAuthController } from '../src/services/auth/iamAuthController.js'
import { installIamAxios } from '../src/services/auth/installIamAxios.js'
import { createIamDeviceStore } from '../src/services/auth/iamDeviceStore.js'
import { createIamAccountService } from '../src/services/auth/iamAccountService.js'
import { routeDecision } from '../src/services/auth/iamRoutePolicy.js'
import { authErrorMessage, isSixDigitCode, safeDestination } from '../src/services/auth/iamUi.js'
import { IamCapabilityError, createIamSession } from '../src/services/auth/iamSession.js'
import { createIamStorage } from '../src/services/auth/iamStorage.js'
import { createMemoryStorage, createSerialCoordinator, createStorageEvents,
  deferred, tokenPair } from './iamFixtures.js'

const pair = (deviceToken = null) => ({ status: 'authenticated', accessToken: 'access',
  refreshToken: 'refresh', tokenType: 'bearer', expiresIn: 60, deviceToken })
const user = { id: 'one', email: 'user@example.test', full_name: 'Usuario',
  tenant_id: 'tenant', role: 'viewer', platform_role: null, memberships: [],
  support_session: null }
const challenge = { status: 'otp_required', challengeId: 'challenge',
  emailHint: 'u***@example.test', otpExpiresIn: 300 }

const setup = ({ restored = 'absent', loginResult = pair(), otpResult = pair('device-returned'),
  resendResult = { ...challenge, challengeId: 'new' }, profile = user,
  capabilityError = null, logoutResult = { revoked: false, localCleared: true,
    reason: 'network_error' } } = {}) => {
  const calls = { login: [], otp: [], resend: [], accepted: [], profile: [], refresh: 0,
    legacy: 0, sync: 0 }
  const listeners = new Set()
  let managerStatus = 'uninitialized'
  let contextId = null
  let generation = 0
  let accessToken = null
  let restoreStatus = restored
  const manager = {
    checkCapabilities: async () => { if (capabilityError) throw capabilityError },
    startSync: () => { calls.sync += 1 },
    getState: () => ({ status: managerStatus }),
    getContextSnapshot: () => ({ contextId, generation }),
    isSameContext: (snapshot) => contextId === snapshot.contextId
      && generation === snapshot.generation,
    getAccessToken: () => accessToken,
    restore: async () => {
      managerStatus = restoreStatus
      contextId = restoreStatus === 'pending_restore' ? 'restored' : null
      return { status: restoreStatus }
    },
    refresh: async () => {
      calls.refresh += 1
      accessToken = 'refreshed-access'
      managerStatus = 'tokens_available'
      return accessToken
    },
    acceptTokens: async (result, options) => {
      calls.accepted.push({ result, options })
      contextId = `context-${++generation}`
      accessToken = result.accessToken
      managerStatus = 'tokens_available'
    },
    invalidateLocal: async () => {
      contextId = null; generation += 1; accessToken = null; managerStatus = 'absent'
      listeners.forEach((listener) => listener())
      return { localCleared: true }
    },
    logout: async () => {
      contextId = null; generation += 1; accessToken = null; managerStatus = 'absent'
      listeners.forEach((listener) => listener())
      return logoutResult
    },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
    changeContext: () => {
      contextId = 'other'; generation += 1
      listeners.forEach((listener) => listener())
    },
    setRestoreStatus: (value) => { restoreStatus = value },
    externalLogoutWhileStopped: () => {
      restoreStatus = 'absent'; managerStatus = 'absent'; contextId = null
      generation += 1; accessToken = null
    },
  }
  const transport = {
    login: async (body) => { calls.login.push(body)
      return typeof loginResult === 'function' ? loginResult() : loginResult },
    verifyOtp: async (body) => { calls.otp.push(body)
      return typeof otpResult === 'function' ? otpResult() : otpResult },
    resendOtp: async (id) => { calls.resend.push(id)
      return typeof resendResult === 'function' ? resendResult() : resendResult },
    getCurrentUser: async (access) => { calls.profile.push(access)
      return typeof profile === 'function' ? profile() : profile },
  }
  const storage = createMemoryStorage()
  const deviceStore = createIamDeviceStore({ apiBaseUrl: 'https://api.example.test', storage })
  const auth = createIamAuthController({ manager, transport, deviceStore,
    clearLegacy: () => { calls.legacy += 1 } })
  return { auth, manager, calls, deviceStore, storage }
}

test('login authenticated valida /users/me, conserva roles y respeta sesión temporal', async () => {
  const { auth, calls } = setup()
  await auth.bootstrap()
  const result = await auth.beginLogin({ email: ' User@Example.test ', password: 'secret' })
  assert.equal(result.status, 'authenticated')
  assert.equal(auth.getState().user, user)
  assert.deepEqual(calls.accepted[0].options, { rememberSession: false })
  assert.equal(calls.login[0].email, 'user@example.test')
  assert.deepEqual(calls.profile, ['access'])
  assert.ok(calls.legacy >= 1)
})

test('OTP no publica usuario antes de validar código; reenvío reemplaza challenge', async () => {
  const { auth, calls, deviceStore } = setup({ loginResult: challenge })
  deviceStore.save('user@example.test', 'old-device')
  const first = await auth.beginLogin({ email: 'user@example.test', password: 'secret',
    rememberSession: true })
  assert.equal(first.challengeId, 'challenge')
  assert.equal(auth.getState().status, 'anonymous')
  assert.equal(deviceStore.get('user@example.test'), null)
  const next = await auth.resendOtp(first.challengeId)
  assert.equal(next.challengeId, 'new')
  assert.deepEqual(calls.resend, ['challenge'])
  await auth.completeOtp({ email: 'user@example.test', challengeId: next.challengeId,
    code: '123456', rememberSession: true, rememberDevice: true })
  assert.deepEqual(calls.otp[0], { challengeId: 'new', code: '123456', rememberDevice: true })
  assert.equal(calls.accepted[0].options.rememberSession, true)
  assert.equal(deviceStore.get('user@example.test'), 'device-returned')
  assert.equal(auth.getState().status, 'authenticated')
})

test('OTP fallido permite reintentar sin persistir dispositivo no elegido', async () => {
  let attempt = 0
  const { auth, deviceStore } = setup({ loginResult: challenge, otpResult: () => {
    attempt += 1
    if (attempt === 1) throw { status: 400, code: 'http_error' }
    return pair('not-requested')
  } })
  await auth.beginLogin({ email: user.email, password: 'secret' })
  await assert.rejects(auth.completeOtp({ email: user.email, challengeId: 'challenge',
    code: '000000' }), { status: 400 })
  assert.equal(auth.getState().user, null)
  await auth.completeOtp({ email: user.email, challengeId: 'challenge', code: '123456' })
  assert.equal(auth.getState().status, 'authenticated')
  assert.equal(deviceStore.get(user.email), null)
})

test('el loading del login posterior al bootstrap conserva el paso OTP montado', async () => {
  const pending = deferred()
  const { auth } = setup({ loginResult: pending.promise })
  await auth.bootstrap()
  assert.equal(auth.getState().hasBootstrapped, true)
  const request = auth.beginLogin({ email: user.email, password: 'secret' })
  assert.equal(auth.getState().status, 'bootstrapping')
  assert.equal(auth.getState().hasBootstrapped, true)
  pending.resolve(challenge)
  await request
  assert.equal(auth.getState().status, 'anonymous')
})

test('preflight fallido evita request de login y no autentica', async () => {
  const { auth, calls } = setup({ capabilityError: new IamCapabilityError('coordination_unavailable') })
  await assert.rejects(auth.beginLogin({ email: user.email, password: 'secret' }),
    { code: 'coordination_unavailable' })
  assert.equal(calls.login.length, 0)
  assert.equal(auth.getState().status, 'unsupported')
})

test('bootstrap comparte trabajo y valida refresh antes de publicar identidad', async () => {
  const pending = deferred()
  const { auth, calls } = setup({ restored: 'pending_restore', profile: () => pending.promise })
  const first = auth.bootstrap()
  assert.equal(auth.bootstrap(), first)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(auth.getState().status, 'bootstrapping')
  assert.equal(calls.refresh, 1)
  pending.resolve(user)
  await first
  assert.equal(auth.getState().status, 'authenticated')
  assert.deepEqual(calls.profile, ['refreshed-access'])
})

test('bootstrap sin sesión y red caída no fabrican identidad; retry recupera', async () => {
  const absent = setup()
  await absent.auth.bootstrap()
  assert.equal(absent.auth.getState().status, 'anonymous')
  let online = false
  const interrupted = setup({ restored: 'pending_restore', profile: () => {
    if (!online) throw { code: 'network_error' }
    return user
  } })
  await interrupted.auth.bootstrap()
  assert.equal(interrupted.auth.getState().status, 'unavailable')
  assert.equal(interrupted.auth.getState().user, null)
  online = true
  await interrupted.auth.retry()
  assert.equal(interrupted.auth.getState().status, 'authenticated')
})

test('/users/me 401 rota una vez y valida el perfil, segundo 401 invalida local', async () => {
  let calls = 0
  const recovered = setup({ profile: () => {
    calls += 1
    if (calls === 1) throw { status: 401 }
    return user
  } })
  await recovered.auth.beginLogin({ email: user.email, password: 'secret' })
  assert.equal(recovered.calls.refresh, 1)
  assert.deepEqual(recovered.calls.profile, ['access', 'refreshed-access'])
  const rejected = setup({ profile: () => { throw { status: 401 } } })
  await assert.rejects(rejected.auth.beginLogin({ email: user.email, password: 'secret' }),
    { status: 401 })
  assert.equal(rejected.calls.refresh, 1)
  assert.equal(rejected.manager.getState().status, 'absent')
  assert.equal(rejected.auth.getState().status, 'anonymous')
})

test('logout remoto fallido y cambio de contexto descartan usuario', async () => {
  const { auth, manager } = setup()
  await auth.beginLogin({ email: user.email, password: 'secret' })
  manager.changeContext()
  assert.equal(auth.getState().status, 'anonymous')
  await auth.beginLogin({ email: user.email, password: 'secret' })
  assert.deepEqual(await auth.logout(), { revoked: false, localCleared: true,
    reason: 'network_error' })
  assert.equal(auth.getState().user, null)
  assert.equal(auth.getState().logoutResult.revoked, false)
})

test('logout confirmado informa revocación y no conserva identidad', async () => {
  const { auth } = setup({ logoutResult: { revoked: true, localCleared: true } })
  await auth.beginLogin({ email: user.email, password: 'secret' })
  await auth.logout()
  assert.equal(auth.getState().logoutResult.revoked, true)
  assert.equal(auth.getState().user, null)
})

test('logout remoto tardío no borra un login nuevo en React', async () => {
  const remote = deferred()
  const { auth } = setup({ logoutResult: remote.promise })
  await auth.beginLogin({ email: user.email, password: 'secret' })
  const closing = auth.logout()
  await auth.beginLogin({ email: user.email, password: 'secret' })
  remote.resolve({ revoked: true, localCleared: true })
  await closing
  assert.equal(auth.getState().status, 'authenticated')
  assert.equal(auth.getState().user, user)
})

test('respuesta tardía de /users/me no restaura sesión anterior', async () => {
  const pending = deferred()
  const { auth, manager } = setup({ profile: () => pending.promise })
  const login = auth.beginLogin({ email: user.email, password: 'secret' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  manager.changeContext()
  pending.resolve(user)
  await assert.rejects(login, { code: 'context_changed' })
  assert.notEqual(auth.getState().status, 'authenticated')
})

test('dispositivo se asocia a email y reset lo limpia sin tocar otro correo', async () => {
  const { auth, deviceStore } = setup()
  deviceStore.save('USER@example.test', 'token-a')
  deviceStore.save('other@example.test', 'token-b')
  assert.equal(deviceStore.get('user@example.test'), 'token-a')
  await auth.invalidateAfterPasswordReset('user@example.test')
  assert.equal(deviceStore.get('user@example.test'), null)
  assert.equal(deviceStore.get('other@example.test'), 'token-b')
})

test('rutas requieren tenant activo y rol real; destino de login queda interno', () => {
  assert.equal(routeDecision({ status: 'bootstrapping', user: null }), 'loading')
  assert.equal(routeDecision({ status: 'unavailable', user: null }), 'error')
  assert.equal(routeDecision({ status: 'anonymous', user: null }), 'login')
  assert.equal(routeDecision({ status: 'authenticated', user: { ...user,
    tenant_id: null, role: null, platform_role: 'superadmin' } }), 'no_tenant')
  assert.equal(routeDecision({ status: 'authenticated', user }, ['admin']), 'forbidden')
  assert.equal(routeDecision({ status: 'authenticated', user }), 'allow')
  assert.equal(safeDestination('https://evil.example'), '/dashboard')
  assert.equal(safeDestination('//evil.example'), '/dashboard')
  assert.equal(safeDestination({ pathname: '/executions/one' }), '/executions/one')
})

test('forgot/reset usan contrato real y normalizan 429/422 sin reflejar secretos', async () => {
  const calls = []
  const api = { post: async (route, body) => { calls.push({ route, body })
    if (route === '/auth/reset-password') throw { response: { status: 422,
      data: { detail: `code=${body.code}` } } } } }
  const account = createIamAccountService(api)
  await account.forgotPassword(' User@Example.test ')
  assert.deepEqual(calls[0], { route: '/auth/forgot-password',
    body: { email: 'user@example.test' } })
  await assert.rejects(account.resetPassword({ email: user.email,
    code: '123456', newPassword: 'Secret123' }), (error) => {
    assert.equal(error.status, 422)
    assert.equal(error.detail, null)
    return true
  })
  assert.deepEqual(calls[1].body, { email: user.email, code: '123456',
    new_password: 'Secret123' })
  assert.match(authErrorMessage({ status: 429 }), /Demasiados/)
  assert.match(authErrorMessage({ status: 422 }), /Revisá/)
  assert.equal(isSixDigitCode('123456'), true)
  assert.equal(isSixDigitCode('12345'), false)
  assert.equal(isSixDigitCode('12345a'), false)
})

test('runtime comparte un interceptor Axios y limpia al desmontar', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    server: { middlewareMode: true } })
  try {
    const runtime = await vite.ssrLoadModule('/src/services/auth/iamRuntime.js')
    const client = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const suspend = runtime.iamAuth.suspend
    let suspensions = 0
    runtime.iamAuth.suspend = () => { suspensions += 1; suspend() }
    const count = () => client.interceptors.request.handlers.filter(Boolean).length
    const first = runtime.acquireIamRuntime()
    const second = runtime.acquireIamRuntime()
    assert.equal(count(), 1)
    first()
    assert.equal(count(), 1)
    second()
    const remount = runtime.acquireIamRuntime()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(count(), 1)
    assert.equal(suspensions, 0)
    remount()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(count(), 0)
    assert.equal(suspensions, 1)
  } finally {
    await vite.close()
  }
})

test('bootstrap inicial y remount efectivo revalidan; StrictMode comparte el trabajo', async () => {
  const absent = setup()
  const initial = absent.auth.bootstrap()
  assert.equal(absent.auth.bootstrap(), initial)
  await initial
  assert.equal(absent.auth.getState().status, 'anonymous')
  assert.equal(absent.calls.sync, 1)

  const valid = setup({ restored: 'pending_restore' })
  await valid.auth.bootstrap()
  assert.equal(valid.auth.getState().status, 'authenticated')
  assert.equal(valid.calls.profile.length, 1)
  assert.equal(valid.calls.sync, 1)
  valid.auth.suspend()
  assert.equal(valid.auth.getState().status, 'bootstrapping')
  assert.equal(valid.auth.getState().user, null)
  const remount = valid.auth.bootstrap()
  assert.equal(valid.auth.bootstrap(), remount)
  await remount
  assert.equal(valid.calls.sync, 2)
  assert.equal(valid.calls.profile.length, 2)
  assert.equal(valid.auth.getState().status, 'authenticated')
})

test('logout externo durante desmontaje y bootstrap anterior tardío no publican usuario', async () => {
  const external = setup({ restored: 'pending_restore' })
  await external.auth.bootstrap()
  external.auth.suspend()
  external.manager.externalLogoutWhileStopped()
  await external.auth.bootstrap()
  assert.equal(external.auth.getState().status, 'anonymous')
  assert.equal(external.auth.getState().user, null)

  const oldProfile = deferred()
  let requests = 0
  const late = setup({ restored: 'pending_restore', profile: () => {
    requests += 1
    return requests === 1 ? oldProfile.promise : user
  } })
  const previous = late.auth.bootstrap()
  await new Promise((resolve) => setTimeout(resolve, 0))
  late.auth.suspend()
  await late.auth.bootstrap()
  oldProfile.resolve({ ...user, id: 'old' })
  await previous
  assert.equal(late.auth.getState().user.id, user.id)
})

test('gestor real reinstala un único listener storage y detecta logout al remontar', async () => {
  const persistent = createMemoryStorage()
  const temporary = createMemoryStorage()
  const events = createStorageEvents()
  const storage = createIamStorage({ apiBaseUrl: 'https://api.example.test',
    temporaryStorage: temporary, persistentStorage: persistent })
  let sequence = 0
  const manager = createIamSession({ transport: {
    refresh: async () => tokenPair('restored'), logout: async () => ({ revoked: true }),
  }, storage, coordinator: createSerialCoordinator(), clock: () => 1000,
  idFactory: () => `id-${++sequence}` })
  const startSync = manager.startSync
  manager.startSync = () => startSync(events)
  await manager.acceptTokens(tokenPair('initial'), { rememberSession: true })
  const auth = createIamAuthController({ manager,
    transport: { getCurrentUser: async () => user } })
  await auth.bootstrap()
  assert.equal(auth.getState().status, 'authenticated')
  assert.equal(events.listenerCount(), 1)
  auth.suspend()
  manager.stopSync()
  assert.equal(events.listenerCount(), 0)
  await auth.bootstrap()
  assert.equal(events.listenerCount(), 1)
  assert.equal(auth.getState().status, 'authenticated')
  const context = manager.getContextSnapshot().contextId
  storage.clearContext(context)
  events.dispatch({ key: `mconnect:iam:v1:${encodeURIComponent(storage.scope)}:rotation`,
    storageArea: persistent })
  assert.equal(auth.getState().status, 'anonymous')
  auth.suspend()
  manager.stopSync()
  assert.equal(events.listenerCount(), 0)
  await auth.bootstrap()
  assert.equal(auth.getState().status, 'anonymous')
  assert.equal(events.listenerCount(), 1)
  manager.stopSync()
  auth.dispose()
})

test('OTP cancelado descarta verificación y reenvío tardíos sin afectar un login nuevo', async () => {
  const verify = deferred()
  const resend = deferred()
  let logins = 0
  const nextChallenge = { ...challenge, challengeId: 'next' }
  const flow = setup({ loginResult: () => (++logins === 1 ? challenge : nextChallenge),
    otpResult: () => verify.promise, resendResult: () => resend.promise })
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  const pendingVerify = flow.auth.completeOtp({ email: user.email,
    challengeId: challenge.challengeId, code: '123456' })
  await flow.auth.cancelOtp()
  verify.resolve(pair())
  await assert.rejects(pendingVerify, { code: 'context_changed' })
  assert.equal(flow.calls.accepted.length, 0)
  assert.equal(flow.auth.getState().status, 'anonymous')

  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  const pendingResend = flow.auth.resendOtp(nextChallenge.challengeId)
  await flow.auth.cancelOtp()
  resend.resolve({ ...challenge, challengeId: 'old-resend' })
  await assert.rejects(pendingResend, { code: 'otp_cancelled' })
  assert.equal(flow.auth.getState().status, 'anonymous')
  await assert.rejects(flow.auth.completeOtp({ email: user.email,
    challengeId: challenge.challengeId, code: '123456' }), { code: 'otp_cancelled' })
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  assert.equal(logins, 3)
  assert.equal(flow.auth.getState().status, 'anonymous')
  await assert.rejects(flow.auth.completeOtp({ email: user.email,
    challengeId: challenge.challengeId, code: '123456' }), { code: 'otp_cancelled' })
  assert.equal(flow.calls.otp.length, 1)
})

test('desmontaje durante OTP pendiente invalida la respuesta del controlador', async () => {
  const response = deferred()
  const flow = setup({ loginResult: challenge, otpResult: () => response.promise })
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  const verification = flow.auth.completeOtp({ email: user.email,
    challengeId: challenge.challengeId, code: '123456' })
  // El cleanup de LoginForm llama a cancelOtp al desmontarse.
  await flow.auth.cancelOtp()
  response.resolve(pair('device'))
  await assert.rejects(verification, { code: 'context_changed' })
  assert.equal(flow.calls.accepted.length, 0)
  assert.equal(flow.auth.getState().user, null)
})

test('desmontaje provocado por OTP ya validado conserva la sesión', async () => {
  const flow = setup({ loginResult: challenge })
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  const unsubscribe = flow.auth.subscribe(() => {
    if (flow.auth.getState().status === 'authenticated') {
      void flow.auth.cancelOtp()
    }
  })
  try {
    await flow.auth.completeOtp({ email: user.email,
      challengeId: challenge.challengeId, code: '123456' })
    assert.equal(flow.auth.getState().status, 'authenticated')
    assert.equal(flow.auth.getState().user, user)
  } finally {
    unsubscribe()
  }
})

test('403 de negocio revalida una vez por contexto, actualiza rol y conserva errores originales', async () => {
  const newProfile = deferred()
  let profileCalls = 0
  const admin = { ...user, role: 'admin' }
  const flow = setup({ profile: () => (++profileCalls === 1 ? admin : newProfile.promise) })
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  const client = axios.create({ baseURL: 'https://api.example.test', adapter: (config) =>
    Promise.reject(new axios.AxiosError('forbidden', axios.AxiosError.ERR_BAD_RESPONSE,
      config, null, { config, status: 403, data: null, headers: {} })) })
  const uninstall = installIamAxios(client, { manager: flow.manager,
    apiBaseUrl: 'https://api.example.test',
    onForbidden: flow.auth.revalidateAfterForbidden })
  try {
    const requests = [client.get('/protected/one'), client.get('/protected/two')]
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(flow.calls.profile.length, 2)
    newProfile.resolve({ ...user, role: 'viewer' })
    const results = await Promise.allSettled(requests)
    assert.equal(results.every((item) => item.status === 'rejected'
      && item.reason.response.status === 403), true)
    assert.equal(flow.calls.profile.length, 2)
    assert.equal(flow.auth.getState().user.role, 'viewer')
    assert.equal(routeDecision(flow.auth.getState(), ['admin']), 'forbidden')
  } finally {
    uninstall()
  }
})

test('403 público o de /users/me no revalida; un 403 viejo no altera otro login', async () => {
  const oldResponse = deferred()
  const flow = setup()
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  let checks = 0
  let oldConfig = null
  const client = axios.create({ baseURL: 'https://api.example.test', adapter: (config) => {
    if (config.url === '/old') { oldConfig = config; return oldResponse.promise }
    return Promise.reject(new axios.AxiosError('forbidden', axios.AxiosError.ERR_BAD_RESPONSE,
      config, null, { config, status: 403, data: null, headers: {} }))
  } })
  const uninstall = installIamAxios(client, { manager: flow.manager,
    apiBaseUrl: 'https://api.example.test', onForbidden: () => { checks += 1 } })
  try {
    await assert.rejects(client.post('/auth/forgot-password', {}),
      (error) => error.response?.status === 403)
    await assert.rejects(client.get('/users/me'),
      (error) => error.response?.status === 403)
    assert.equal(checks, 0)
    const old = client.get('/old')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flow.auth.beginLogin({ email: user.email, password: 'secret' })
    oldResponse.reject(new axios.AxiosError('forbidden',
      axios.AxiosError.ERR_BAD_RESPONSE, oldConfig, null,
      { config: oldConfig, status: 403, data: null, headers: {} }))
    await assert.rejects(old)
    assert.equal(checks, 0)
    assert.equal(flow.auth.getState().status, 'authenticated')
  } finally {
    uninstall()
  }
})

test('revalidación fallida no inventa permisos y no concede tenant al superadmin', async () => {
  let calls = 0
  const flow = setup({ profile: () => {
    calls += 1
    if (calls === 1) return { ...user, role: 'admin' }
    throw { code: 'network_error' }
  } })
  await flow.auth.beginLogin({ email: user.email, password: 'secret' })
  const context = flow.manager.getContextSnapshot()
  await flow.auth.revalidateAfterForbidden(context)
  assert.equal(flow.auth.getState().status, 'unavailable')
  assert.equal(flow.auth.getState().user, null)
  assert.equal(routeDecision({ status: 'authenticated', user: { ...user,
    tenant_id: null, role: null, platform_role: 'superadmin' } }), 'no_tenant')
})

test('revalidación actualiza ausencia de tenant y /users/me 403 no recurre', async () => {
  const withoutTenant = { ...user, tenant_id: null, role: null,
    platform_role: 'superadmin' }
  let reads = 0
  const changed = setup({ profile: () => (++reads === 1 ? { ...user, role: 'admin' }
    : withoutTenant) })
  await changed.auth.beginLogin({ email: user.email, password: 'secret' })
  await changed.auth.revalidateAfterForbidden(changed.manager.getContextSnapshot())
  assert.equal(changed.auth.getState().status, 'authenticated')
  assert.equal(changed.auth.getState().user.tenant_id, null)
  assert.equal(routeDecision(changed.auth.getState(), ['admin']), 'no_tenant')

  let deniedReads = 0
  const denied = setup({ profile: () => {
    deniedReads += 1
    if (deniedReads === 1) return { ...user, role: 'admin' }
    throw { status: 403 }
  } })
  await denied.auth.beginLogin({ email: user.email, password: 'secret' })
  await denied.auth.revalidateAfterForbidden(denied.manager.getContextSnapshot())
  assert.equal(deniedReads, 2)
  assert.equal(denied.auth.getState().status, 'unavailable')
  assert.equal(denied.auth.getState().user, null)
})

test('alta retirada no tiene acción visible ni consumidor; aliases compatibles continúan', async () => {
  const page = await readFile(new URL('../src/pages/users/UserAdminPage.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /createUser|buildTemporaryPassword|POST \/users\/|Invitar usuario/)
  assert.match(page, /Invitaciones pendientes/)
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    server: { middlewareMode: true } })
  try {
    const service = (await vite.ssrLoadModule('/src/services/api/userAdminService.js')).default
    assert.equal('createUser' in service, false)
    const client = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const routes = []
    client.defaults.adapter = async (config) => {
      routes.push({ method: config.method, url: config.url })
      return { config, status: 200, data: [], headers: {} }
    }
    await service.listUsers()
    await service.updateUser('one', { role: 'viewer' })
    await service.deactivateUser('one')
    assert.deepEqual(routes, [
      { method: 'get', url: '/users/' },
      { method: 'put', url: '/users/one' },
      { method: 'delete', url: '/users/one' },
    ])
  } finally {
    await vite.close()
  }
})
