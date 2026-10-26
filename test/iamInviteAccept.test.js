import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { createIamAuthController } from '../src/services/auth/iamAuthController.js'
import { createIamAccountService } from '../src/services/auth/iamAccountService.js'
import { IamContractError, normalizeInvitationAcceptResult,
  normalizeInvitationPreview } from '../src/services/auth/iamContracts.js'
import { createIamInviteTokenStore } from '../src/services/auth/iamInviteTokenStore.js'
import { createIamTransport, normalizeIamError } from '../src/services/auth/iamTransport.js'
import { installIamAxios } from '../src/services/auth/installIamAxios.js'
import { authErrorMessage, invitationAcceptErrorMessage,
  validateNewPassword } from '../src/services/auth/iamUi.js'
import { createMemoryStorage, deferred } from './iamFixtures.js'

const base = 'https://api.example.test'
const inviteToken = 'KDz3Hw5-invite-token-abcdef'
const password = 'Secret123'
const preview = { email: 'ana@acme.test', tenant_name: 'Acme SA', role: 'admin',
  invited_by: 'El equipo de M-Connect', expires_at: '2026-10-04T12:55:23+00:00',
  account_exists: false }
const acceptResult = { tenant_id: 'tenant-b', tenant_name: 'Beta SA', role: 'operator' }
const rawAuthenticated = { status: 'authenticated', access_token: 'access-invite',
  refresh_token: 'refresh-invite', token_type: 'bearer', expires_in: 60 }
const pair = { status: 'authenticated', accessToken: 'access-invite',
  refreshToken: 'refresh-invite', tokenType: 'bearer', expiresIn: 60, deviceToken: null }
const user = { id: 'one', email: 'ana@acme.test', full_name: 'Ana', tenant_id: 'tenant-a',
  role: 'admin', platform_role: null, memberships: [], support_session: null }

const response = (config, status, data = null) => ({
  config, status, data, statusText: String(status), headers: {},
})
const rejectStatus = (config, status, data = null) => Promise.reject(new axios.AxiosError(
  `HTTP ${status}`, axios.AxiosError.ERR_BAD_RESPONSE, config, null,
  response(config, status, data),
))

const setup = ({ acceptResponse = pair, profile = user, initialContext = null } = {}) => {
  const calls = { accept: [], accepted: [], profile: [], invalidated: 0, logout: 0 }
  const listeners = new Set()
  let contextId = initialContext
  let generation = 0
  let accessToken = initialContext ? 'access-previous' : null
  let managerStatus = initialContext ? 'tokens_available' : 'uninitialized'
  const notify = () => listeners.forEach((listener) => listener())
  const manager = {
    checkCapabilities: async () => {},
    startSync: () => {},
    getState: () => ({ status: managerStatus }),
    getContextSnapshot: () => ({ contextId, generation }),
    isSameContext: (snapshot) => contextId === snapshot.contextId
      && generation === snapshot.generation,
    getAccessToken: () => accessToken,
    restore: async () => ({ status: 'absent' }),
    refresh: async () => accessToken,
    acceptTokens: async (result, options) => {
      calls.accepted.push({ result, options })
      contextId = `context-${++generation}`
      accessToken = result.accessToken
      managerStatus = 'tokens_available'
    },
    invalidateLocal: async () => {
      calls.invalidated += 1
      contextId = null; generation += 1; accessToken = null; managerStatus = 'absent'
      notify()
      return { localCleared: true }
    },
    logout: async () => {
      calls.logout += 1
      contextId = null; generation += 1; accessToken = null; managerStatus = 'absent'
      notify()
      return { revoked: true, localCleared: true }
    },
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener) },
  }
  const transport = {
    acceptInvitation: async (body) => { calls.accept.push(body)
      return typeof acceptResponse === 'function' ? acceptResponse() : acceptResponse },
    login: async () => pair,
    getCurrentUser: async (access) => {
      calls.profile.push({ access, publishedBefore: auth.getState().user })
      return typeof profile === 'function' ? profile() : profile
    },
  }
  const storage = createMemoryStorage()
  const inviteTokenStore = createIamInviteTokenStore({ apiBaseUrl: base, storage })
  const auth = createIamAuthController({ manager, transport, inviteTokenStore })
  return { auth, calls, inviteTokenStore, storage }
}

test('IAM-4E normalizadores aceptan el contrato y rechazan formas inválidas', () => {
  assert.deepEqual(normalizeInvitationPreview({ ...preview, extra: 'x' }), preview)
  assert.deepEqual(normalizeInvitationPreview({ ...preview, invited_by: null }),
    { ...preview, invited_by: null })
  for (const invalid of [null, [], { ...preview, email: '' },
    { ...preview, tenant_name: 4 }, { ...preview, role: null },
    { ...preview, invited_by: undefined }, { ...preview, expires_at: '' },
    { ...preview, account_exists: 'false' }]) {
    assert.throws(() => normalizeInvitationPreview(invalid),
      { name: 'IamContractError', code: 'invalid_invitation_preview' })
  }
  assert.deepEqual(normalizeInvitationAcceptResult({ ...acceptResult, extra: true }), acceptResult)
  for (const invalid of [undefined, 'ok', { ...acceptResult, tenant_id: '' },
    { ...acceptResult, tenant_name: null }, { ...acceptResult, role: 1 }]) {
    assert.throws(() => normalizeInvitationAcceptResult(invalid),
      { name: 'IamContractError', code: 'invalid_invitation_accept_result' })
  }
})

test('IAM-4E transporte acepta sólo sesiones authenticated y oculta secretos', async () => {
  const calls = []
  let reply = rawAuthenticated
  const transport = createIamTransport({ get: async () => ({}),
    post: async (route, body) => { calls.push({ route, body })
      return typeof reply === 'function' ? reply() : { data: reply } } })
  assert.deepEqual(await transport.acceptInvitation({ token: inviteToken, password,
    fullName: '  Ana  ' }), pair)
  await transport.acceptInvitation({ token: inviteToken, password, fullName: '   ' })
  assert.deepEqual(calls, [
    { route: '/auth/invitations/accept',
      body: { token: inviteToken, password, full_name: 'Ana' } },
    { route: '/auth/invitations/accept', body: { token: inviteToken, password } },
  ])
  reply = { status: 'otp_required', challenge_id: 'challenge', email_hint: 'a***@acme.test',
    otp_expires_in: 300, token_type: 'bearer' }
  await assert.rejects(transport.acceptInvitation({ token: inviteToken, password }),
    (error) => error instanceof IamContractError && error.code === 'invalid_invitation_response')
  reply = { status: 'unknown' }
  await assert.rejects(transport.acceptInvitation({ token: inviteToken, password }),
    { code: 'unknown_login_status' })
  reply = () => { throw { response: { status: 409,
    data: { detail: `token ${inviteToken} usa ${password}` } } } }
  await assert.rejects(transport.acceptInvitation({ token: inviteToken, password }),
    (error) => error.status === 409 && error.detail === null)
})

test('IAM-4E controlador acepta tokens con la sesión elegida y publica tras /users/me', async () => {
  const { auth, calls } = setup()
  await auth.bootstrap()
  const result = await auth.acceptInvitation({ token: inviteToken, password, fullName: 'Ana' })
  assert.deepEqual(result, { status: 'authenticated', user })
  assert.deepEqual(calls.accept, [{ token: inviteToken, password, fullName: 'Ana' }])
  assert.deepEqual(calls.accepted, [{ result: pair, options: { rememberSession: false } }])
  assert.deepEqual(calls.profile, [{ access: 'access-invite', publishedBefore: null }])
  assert.equal(auth.getState().status, 'authenticated')
  assert.equal(auth.getState().user, user)

  const remembered = setup()
  await remembered.auth.acceptInvitation({ token: inviteToken, password, rememberSession: true })
  assert.deepEqual(remembered.calls.accepted[0].options, { rememberSession: true })
})

test('IAM-4E controlador invalida la sesión previa antes de aceptar', async () => {
  const order = []
  const env = setup({ initialContext: 'previous',
    acceptResponse: () => { order.push(`accept:${env.calls.invalidated}`); return pair } })
  await env.auth.acceptInvitation({ token: inviteToken, password })
  assert.deepEqual(order, ['accept:1'])
  assert.equal(env.auth.getState().status, 'authenticated')
})

test('IAM-4E un logout o login intermedio descarta la aceptación tardía', async () => {
  const late = deferred()
  const first = setup({ acceptResponse: () => late.promise })
  const accepting = first.auth.acceptInvitation({ token: inviteToken, password })
  await new Promise((resolve) => setTimeout(resolve, 0))
  await first.auth.logout()
  late.resolve(pair)
  await assert.rejects(accepting, { code: 'context_changed' })
  assert.equal(first.calls.accepted.length, 0)
  assert.equal(first.auth.getState().user, null)

  const lateProfile = deferred()
  let profileCalls = 0
  const second = setup({ profile: () => (++profileCalls === 1 ? lateProfile.promise : user) })
  const pending = second.auth.acceptInvitation({ token: inviteToken, password })
  await new Promise((resolve) => setTimeout(resolve, 0))
  await second.auth.beginLogin({ email: user.email, password })
  lateProfile.resolve({ ...user, email: 'old@acme.test' })
  await assert.rejects(pending, { code: 'context_changed' })
  assert.equal(second.auth.getState().user, user)
})

test('IAM-4E errores de aceptación no publican usuario y se relanzan', async () => {
  const rejected = normalizeIamError({ response: { status: 410 } })
  const { auth } = setup({ acceptResponse: () => { throw rejected } })
  await assert.rejects(auth.acceptInvitation({ token: inviteToken, password }),
    (error) => error === rejected)
  assert.equal(auth.getState().status, 'unavailable')
  assert.equal(auth.getState().user, null)
})

test('IAM-4E logout borra el token pendiente; el login lo conserva', async () => {
  const { auth, inviteTokenStore } = setup()
  inviteTokenStore.save(inviteToken)
  await auth.beginLogin({ email: user.email, password })
  assert.equal(inviteTokenStore.get(), inviteToken)
  await auth.logout()
  assert.equal(inviteTokenStore.get(), null)
})

test('IAM-4E rutas públicas de invitación van sin Bearer y sin sesión', async () => {
  const seen = []
  const client = axios.create({ baseURL: base, headers: { Authorization: 'Bearer stale' },
    adapter: async (config) => {
      seen.push({ url: config.url, authorization: config.headers.get('Authorization') })
      return response(config, 200, config.url.endsWith('inspect') ? preview : rawAuthenticated)
    } })
  const manager = { getAccessToken: () => null, getState: () => ({ status: 'absent' }),
    getContextSnapshot: () => ({ contextId: null, generation: 0 }),
    isSameContext: () => true, refresh: async () => { throw new Error('no refresh') } }
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base,
    isBusinessReady: () => false })
  try {
    const account = createIamAccountService(client)
    assert.deepEqual(await account.inspectInvitation(inviteToken), preview)
    await client.post('/auth/invitations/accept', { token: inviteToken, password })
    assert.deepEqual(seen, [
      { url: '/auth/invitations/inspect', authorization: undefined },
      { url: '/auth/invitations/accept', authorization: undefined },
    ])
  } finally { uninstall() }
})

test('IAM-4E aceptar con sesión no se reenvía tras 401 y espera la validación', async () => {
  const seen = []
  let ready = true
  let refreshes = 0
  let accessToken = 'access-one'
  let revision = 1
  const client = axios.create({ baseURL: base, adapter: async (config) => {
    seen.push({ skip: config._iamSkipAuthRetry, data: JSON.parse(config.data),
      authorization: config.headers.get('Authorization') })
    return rejectStatus(config, 401)
  } })
  const manager = { getAccessToken: () => accessToken,
    getState: () => ({ status: 'tokens_available' }),
    getContextSnapshot: () => ({ contextId: 'context-one', generation: 1, tokenRevision: revision }),
    isSameContext: (snapshot) => snapshot.contextId === 'context-one' && snapshot.generation === 1,
    refresh: async () => { refreshes += 1; revision += 1; accessToken = 'access-two'; return accessToken } }
  const uninstall = installIamAxios(client, { manager, apiBaseUrl: base,
    isBusinessReady: () => ready })
  try {
    const account = createIamAccountService(client)
    await assert.rejects(account.acceptInvitationWithSession(inviteToken),
      (error) => error.name === 'IamTransportError' && error.status === 401)
    assert.deepEqual(seen, [{ skip: true, data: { token: inviteToken },
      authorization: 'Bearer access-one' }])
    assert.equal(refreshes, 1)

    ready = false
    await assert.rejects(account.acceptInvitationWithSession(inviteToken),
      { name: 'IamSessionError', code: 'authorization_pending' })
    assert.equal(seen.length, 1)
  } finally { uninstall() }
})

test('IAM-4E servicio de cuenta normaliza respuestas y errores sin reflejar el token', async () => {
  let reply = { data: acceptResult }
  const account = createIamAccountService({ post: async () => {
    if (reply instanceof Error || reply.response) throw reply
    return reply
  } })
  assert.deepEqual(await account.acceptInvitationWithSession(inviteToken), acceptResult)
  reply = { data: { ...acceptResult, tenant_id: null } }
  await assert.rejects(account.acceptInvitationWithSession(inviteToken),
    { code: 'invalid_invitation_accept_result' })
  reply = { data: { ...preview, account_exists: null } }
  await assert.rejects(account.inspectInvitation(inviteToken),
    { code: 'invalid_invitation_preview' })
  reply = { response: { status: 410, data: { detail: `Token ${inviteToken} vencido` } } }
  await assert.rejects(account.inspectInvitation(inviteToken),
    (error) => error.status === 410 && error.detail === null)
})

test('IAM-4E store del token usa la clave IAM por alcance y tolera storage caído', () => {
  const storage = createMemoryStorage({ other: 'keep' })
  const store = createIamInviteTokenStore({ apiBaseUrl: `${base}/v1/`, storage })
  assert.equal(store.get(), null)
  assert.equal(store.save(inviteToken), true)
  assert.deepEqual(storage.entries(), [['other', 'keep'],
    [`mconnect:iam:v1:${encodeURIComponent(`${base}/v1`)}:invite-token`, inviteToken]])
  assert.equal(store.get(), inviteToken)
  assert.equal(store.save(''), false)
  assert.equal(store.save(null), false)
  assert.equal(store.clear(), true)
  assert.equal(store.get(), null)
  assert.deepEqual(storage.entries(), [['other', 'keep']])

  const broken = { getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  const failing = createIamInviteTokenStore({ apiBaseUrl: base, storage: broken })
  assert.equal(failing.get(), null)
  assert.equal(failing.save(inviteToken), false)
  assert.equal(failing.clear(), false)
  assert.throws(() => createIamInviteTokenStore({ apiBaseUrl: 'ftp://api.example.test' }),
    { code: 'invalid_api_scope' })
})

test('IAM-4E validateNewPassword aplica cada regla con los mensajes de reset', () => {
  const check = (value, confirm = value) =>
    validateNewPassword({ password: value, confirmPassword: confirm })
  assert.deepEqual(check('Secret123'), {})
  assert.equal(check('').password, 'La nueva contraseña es obligatoria.')
  assert.equal(check('Ab1').password, 'La contraseña debe tener al menos 8 caracteres.')
  assert.equal(check('secret123').password, 'Debe incluir al menos una letra mayúscula.')
  assert.equal(check('SECRET123').password, 'Debe incluir al menos una letra minúscula.')
  assert.equal(check('SecretSecret').password, 'Debe incluir al menos un número.')
  assert.equal(check(`Aa1${'ñ'.repeat(35)}`).password, 'La contraseña no puede superar 72 bytes.')
  assert.deepEqual(check(`Aa1${'x'.repeat(69)}`), {})
  assert.equal(check('Secret123', '').confirmPassword,
    'La confirmación de la contraseña es obligatoria.')
  assert.equal(check('Secret123', 'Secret124').confirmPassword, 'Las contraseñas no coinciden.')
})

test('IAM-4E mensajes de invitación deciden por status y no reflejan secretos', () => {
  const fromResponse = (status, data) => normalizeIamError({ response: { status, data } },
    { sensitiveValues: [inviteToken, password] })
  const cases = [
    [fromResponse(410, { detail: 'Invitación vencida' }), /no es válida o ya expiró/],
    [fromResponse(409, { detail: 'La organización está suspendida.' }),
      /^La organización está suspendida\.$/],
    [fromResponse(409, { detail: `Ya existe ${inviteToken}` }), /no se puede aceptar/],
    [fromResponse(403, { detail: 'Otro email' }), /para ana@acme\.test\. Cerrá sesión/],
    [fromResponse(400, { detail: 'Superadmin' }), /administración de plataforma/],
    [fromResponse(429, { error: 'Rate limit' }), /Demasiados intentos/],
    [new axios.AxiosError('down'), /No se pudo conectar/],
  ]
  for (const [error, expected] of cases) {
    const { message, fieldErrors } = invitationAcceptErrorMessage(
      error.status !== undefined ? error : normalizeIamError(error), { email: preview.email })
    assert.match(message, expected)
    assert.deepEqual(fieldErrors, {})
  }
  assert.match(invitationAcceptErrorMessage({ status: 403 }).message, /para otra cuenta/)
  assert.equal(invitationAcceptErrorMessage({ status: 429 }).message,
    authErrorMessage({ status: 429 }))

  const weak = invitationAcceptErrorMessage(fromResponse(422, { detail: [
    { loc: ['body', 'password'], msg: 'La contraseña debe incluir un número', type: 'value_error' },
    { loc: ['body', 'full_name'], msg: 'El nombre es demasiado largo', type: 'string_too_long' },
    { loc: ['body', 'password'], msg: `No uses ${password}`, type: 'value_error' },
  ] }))
  assert.deepEqual(weak, { message: 'Revisá los datos ingresados y volvé a intentar.',
    fieldErrors: { password: 'La contraseña debe incluir un número',
      fullName: 'El nombre es demasiado largo' } })
  const badToken = invitationAcceptErrorMessage(fromResponse(422, { detail: [
    { loc: ['body', 'token'], msg: 'String should have at least 20 characters', type: 'string_too_short' },
  ] }))
  assert.match(badToken.message, /no es válida o ya expiró/)

  for (const status of [400, 403, 409, 410, 422, 429, 500]) {
    const error = fromResponse(status, { detail: `${inviteToken} ${password}`,
      error: `${inviteToken}` })
    const serialized = JSON.stringify(invitationAcceptErrorMessage(error, { email: preview.email }))
    assert.equal(serialized.includes(inviteToken), false)
    assert.equal(serialized.includes(password), false)
  }
})
