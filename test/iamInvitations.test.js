import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { deferred } from './iamFixtures.js'
import { getIamPermissions } from '../src/services/auth/iamPermissions.js'
import { installIamAxios } from '../src/services/auth/installIamAxios.js'
import { createInvitationActionGate, createInvitationReadFlow,
  invitationErrorMessage, validateInvitationDraft } from '../src/services/invitationAdminFlow.js'

const invitation = (id, status = 'pending') => ({ id, tenant_id: 'tenant-a',
  email: `${id}@example.test`, role: 'operator', status,
  created_at: '2026-10-01T12:00:00Z', expires_at: '2026-10-03T12:00:00Z',
  send_count: 1, last_sent_at: null, accepted_at: null, revoked_at: null })

const setupRead = (getInvitations, limit = 2) => {
  const snapshots = []
  const flow = createInvitationReadFlow({ getInvitations, limit,
    onChange: (state) => snapshots.push(state) })
  return { flow, snapshots }
}

test('IAM-4C servicio usa sólo rutas canónicas y el cliente IAM compartido', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const service = (await vite.ssrLoadModule('/src/services/api/invitationAdminService.js')).default
    const client = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const calls = []
    client.defaults.adapter = async (config) => {
      calls.push({ method: config.method, url: config.url,
        params: config.params, data: config.data })
      return { config, status: config.method === 'post' ? 201 :
        config.method === 'delete' ? 204 : 200, data: [], headers: {} }
    }
    await service.getInvitations()
    await service.getInvitations({ status: 'expired', skip: 50, limit: 25,
      tenant_id: 'ignored' })
    await service.createInvitation({ email: 'new@example.test', role: 'viewer',
      tenant_id: 'ignored', password: 'ignored' })
    await service.resendInvitation('inv-id')
    await service.revokeInvitation('inv-id')
    assert.deepEqual(calls, [
      { method: 'get', url: '/tenant/invitations',
        params: { skip: 0, limit: 50 }, data: undefined },
      { method: 'get', url: '/tenant/invitations',
        params: { status: 'expired', skip: 50, limit: 25 }, data: undefined },
      { method: 'post', url: '/tenant/invitations', params: undefined,
        data: JSON.stringify({ email: 'new@example.test', role: 'viewer' }) },
      { method: 'post', url: '/tenant/invitations/inv-id/resend',
        params: undefined, data: undefined },
      { method: 'delete', url: '/tenant/invitations/inv-id',
        params: undefined, data: undefined },
    ])
    client.defaults.adapter = async () => { throw { response: { status: 429,
      data: { detail: 'Esperá unos segundos.' } } } }
    await assert.rejects(service.resendInvitation('inv-id'),
      (error) => error.response.status === 429)
  } finally {
    await vite.close()
  }
})

test('IAM-4C interceptor real: escrituras 401 tienen un despacho y GET conserva retry', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  let uninstall
  try {
    const service = (await vite.ssrLoadModule('/src/services/api/invitationAdminService.js')).default
    const client = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const base = 'https://api.example.test'
    let accessToken = 'access-one'
    let contextId = 'tenant-a'
    let revision = 1
    let refreshes = 0
    let revalidations = 0
    let mode = 401
    const late = deferred()
    const lateStarted = deferred()
    const calls = []
    const fail = (config, status) => Promise.reject(new axios.AxiosError(
      `HTTP ${status}`, axios.AxiosError.ERR_BAD_RESPONSE, config, null,
      { config, status, data: null, statusText: String(status), headers: {} }))
    client.defaults.baseURL = base
    client.defaults.adapter = (config) => {
      calls.push(config)
      if (typeof mode === 'number') return fail(config, mode)
      if (mode === 'get-401' && config.method === 'get' && calls.length === 1) {
        return fail(config, 401)
      }
      if (mode === 'late-401') { lateStarted.resolve(); return late.promise }
      const status = config.method === 'delete' ? 204
        : config.url.endsWith('/resend') || config.method === 'get' ? 200 : 201
      return Promise.resolve({ config, status, data: config.method === 'get' ? [] : {},
        statusText: String(status), headers: {} })
    }
    const manager = {
      getAccessToken: () => accessToken,
      getState: () => ({ status: 'tokens_available' }),
      getContextSnapshot: () => ({ contextId, generation: 1, tokenRevision: revision }),
      isSameContext: (snapshot) => snapshot.contextId === contextId,
      refresh: async () => {
        refreshes += 1
        revision += 1
        accessToken = `access-${refreshes + 1}`
        return accessToken
      },
      invalidateRejected: async () => true,
    }
    uninstall = installIamAxios(client, { manager, apiBaseUrl: base,
      onForbidden: async () => { revalidations += 1 } })

    const operations = [
      { name: 'create', run: () => service.createInvitation({ email: 'a@example.test',
        role: 'viewer', tenant_id: 'ignored', password: 'ignored' }), method: 'post',
      url: '/tenant/invitations' },
      { name: 'resend', run: () => service.resendInvitation('inv-a'), method: 'post',
        url: '/tenant/invitations/inv-a/resend' },
      { name: 'revoke', run: () => service.revokeInvitation('inv-a'), method: 'delete',
        url: '/tenant/invitations/inv-a' },
    ]
    for (const operation of operations) {
      calls.length = 0
      const gate = createInvitationActionGate({ isAllowed: () => true,
        isCurrent: () => true, onPendingChange: () => {} })
      const result = await gate.run(operation.name, operation.run,
        operation.name === 'create' ? 201 : operation.name === 'resend' ? 200 : 204)
      assert.equal(result.kind, 'error')
      assert.equal(result.error.response.status, 401)
      assert.match(invitationErrorMessage(result.error, operation.name), /No se confirmó/)
      assert.equal(calls.length, 1)
      assert.equal(calls[0].method, operation.method)
      assert.equal(calls[0].url, operation.url)
      assert.equal(calls[0]._iamSkipAuthRetry, true)
      assert.equal(calls[0].headers.get('_iamSkipAuthRetry'), undefined)
      gate.dispose()
    }
    assert.equal(refreshes, 3)
    assert.equal(manager.getState().status, 'tokens_available')
    assert.deepEqual(JSON.parse(calls[0].data || '{}'), {})

    mode = 'success'
    for (const operation of operations) {
      calls.length = 0
      const result = await operation.run()
      assert.equal(result.status,
        operation.name === 'create' ? 201 : operation.name === 'resend' ? 200 : 204)
      assert.equal(calls.length, 1)
      assert.equal(calls[0]._iamSkipAuthRetry, true)
      if (operation.name === 'create') {
        assert.deepEqual(JSON.parse(calls[0].data),
          { email: 'a@example.test', role: 'viewer' })
      } else {
        assert.equal(calls[0].data, undefined)
      }
    }

    mode = 'get-401'
    calls.length = 0
    assert.equal((await service.getInvitations()).status, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls.every((config) => config.method === 'get'
      && !config._iamSkipAuthRetry), true)

    for (const status of [403, 409, 429, 503]) {
      mode = status
      calls.length = 0
      await assert.rejects(service.resendInvitation('inv-a'),
        (error) => error.response?.status === status)
      assert.equal(calls.length, 1)
    }
    assert.equal(revalidations, 1)

    mode = 'late-401'
    calls.length = 0
    const pending = service.createInvitation({ email: 'late@example.test', role: 'viewer' })
    await lateStarted.promise
    contextId = 'tenant-b'
    late.reject(new axios.AxiosError('HTTP 401', axios.AxiosError.ERR_BAD_RESPONSE,
      calls[0], null, { config: calls[0], status: 401, data: null, headers: {} }))
    await assert.rejects(pending, { code: 'context_changed' })
    assert.equal(calls.length, 1)
  } finally {
    uninstall?.()
    await vite.close()
  }
})

test('IAM-4C paginación sin total deduplica y bloquea la misma página simultánea', async () => {
  const first = deferred()
  const calls = []
  const { flow } = setupRead((params) => {
    calls.push(params)
    if (calls.length === 1) return first.promise
    if (calls.length === 2) return Promise.resolve({ data: [invitation('b'), invitation('c')] })
    return Promise.resolve({ data: [] })
  })
  const read = flow.refresh()
  await flow.loadMore()
  await flow.refresh()
  assert.equal(calls.length, 1)
  first.resolve({ data: [invitation('a'), invitation('b')] })
  await read
  await flow.loadMore()
  assert.deepEqual(flow.getState().invitations.map((item) => item.id), ['a', 'b', 'c'])
  assert.equal(flow.getState().nextSkip, 4)
  await flow.loadMore()
  assert.equal(flow.getState().hasMore, false)
  assert.deepEqual(calls.map((call) => call.skip), [0, 2, 4])
  flow.dispose()
})

test('IAM-4C un refresco confirmado tras escritura reemplaza una lectura pendiente', async () => {
  const old = deferred()
  const calls = []
  const { flow } = setupRead((params) => {
    calls.push(params)
    return calls.length === 1 ? old.promise : Promise.resolve({ data: [invitation('new')] })
  })
  const pending = flow.refresh()
  await flow.refresh(undefined, { force: true })
  old.resolve({ data: [invitation('old')] })
  await pending
  assert.deepEqual(flow.getState().invitations.map((item) => item.id), ['new'])
  assert.deepEqual(calls.map((call) => call.skip), [0, 0])
  flow.dispose()
})

test('IAM-4C filtro, refresco y desmontaje descartan respuestas antiguas', async () => {
  const old = deferred()
  const fresh = deferred()
  const calls = []
  const { flow, snapshots } = setupRead((params) => {
    calls.push(params)
    return calls.length === 1 ? old.promise : fresh.promise
  })
  const first = flow.refresh()
  const filtered = flow.setStatus('expired')
  assert.deepEqual(calls.map((call) => call.status), ['', 'expired'])
  assert.equal(flow.getState().nextSkip, 0)
  old.resolve({ data: [invitation('old')] })
  await first
  assert.deepEqual(flow.getState().invitations, [])
  fresh.resolve({ data: [invitation('new', 'expired')] })
  await filtered
  assert.deepEqual(flow.getState().invitations.map((item) => item.id), ['new'])
  const before = snapshots.length
  flow.dispose()
  await flow.refresh()
  assert.equal(snapshots.length, before)

  const late = deferred()
  const separate = setupRead(() => late.promise)
  const pending = separate.flow.refresh()
  separate.flow.dispose()
  late.resolve({ data: [invitation('tenant-a')] })
  await pending
  assert.deepEqual(separate.flow.getState().invitations, [])
})

test('IAM-4C 403 vacía datos anteriores y 5xx permite refrescar', async () => {
  let count = 0
  const { flow } = setupRead(async () => {
    count += 1
    if (count === 1) return { data: [invitation('a'), invitation('b')] }
    if (count === 2) throw { response: { status: 403 } }
    if (count === 3) throw { response: { status: 503 } }
    return { data: [] }
  })
  await flow.refresh()
  await flow.loadMore()
  assert.deepEqual(flow.getState().invitations, [])
  assert.match(flow.getState().error, /permiso/)
  await flow.refresh()
  assert.match(flow.getState().error, /Intentá nuevamente/)
  await flow.refresh()
  assert.equal(flow.getState().hasMore, false)
  flow.dispose()
})

test('IAM-4C valida email y rol sin contraseña ni tenant_id', () => {
  assert.match(validateInvitationDraft({ email: '', role: 'operator' }).error, /email/)
  assert.match(validateInvitationDraft({ email: 'invalido', role: 'operator' }).error, /válido/)
  assert.match(validateInvitationDraft({ email: 'a@example.test', role: 'owner' }).error, /rol/)
  assert.deepEqual(validateInvitationDraft({ email: ' a@example.test ', role: 'operator',
    password: 'ignored', tenant_id: 'ignored' }).value,
  { email: 'a@example.test', role: 'operator' })
})

test('IAM-4C escritura bloquea doble envío y exige status confirmado', async () => {
  const pending = deferred()
  const changes = []
  let calls = 0
  const gate = createInvitationActionGate({ isAllowed: () => true, isCurrent: () => true,
    onPendingChange: (value) => changes.push(value) })
  const first = gate.run('create', () => { calls += 1; return pending.promise }, 201)
  assert.deepEqual(await gate.run('create', () => { calls += 1 }, 201), { kind: 'blocked' })
  assert.equal(calls, 1)
  pending.resolve({ status: 201, data: invitation('a') })
  assert.equal((await first).kind, 'success')
  assert.deepEqual(changes, ['create', ''])
  const uncertain = await gate.run('resend:a', async () => ({ status: 202 }), 200)
  assert.equal(uncertain.kind, 'uncertain')
  const revoked = await gate.run('revoke:a', async () => ({ status: 204, data: '' }), 204)
  assert.equal(revoked.kind, 'success')
  gate.dispose()
})

test('IAM-4C permiso y contexto se revisan antes y después de una escritura tardía', async () => {
  let allowed = false
  let current = true
  let calls = 0
  const pending = deferred()
  const gate = createInvitationActionGate({ isAllowed: () => allowed,
    isCurrent: () => current, onPendingChange: () => {} })
  assert.equal((await gate.run('create', () => { calls += 1 }, 201)).kind, 'blocked')
  allowed = true
  const read = gate.run('create', () => { calls += 1; return pending.promise }, 201)
  current = false
  pending.resolve({ status: 201, data: invitation('tenant-a') })
  assert.equal((await read).kind, 'stale')
  assert.equal(calls, 1)
  gate.dispose()

  const downgraded = deferred()
  let roleStillAllowed = true
  const roleGate = createInvitationActionGate({ isAllowed: () => roleStillAllowed,
    isCurrent: () => true, onPendingChange: () => {} })
  const roleRead = roleGate.run('resend:a', () => downgraded.promise, 200)
  roleStillAllowed = false
  downgraded.resolve({ status: 200, data: invitation('a') })
  assert.equal((await roleRead).kind, 'stale')
  roleGate.dispose()

  const viewer = { status: 'authenticated', user: { tenant_id: 'a', role: 'viewer' } }
  const operator = { status: 'authenticated', user: { tenant_id: 'a', role: 'operator' } }
  const admin = { status: 'authenticated', user: { tenant_id: 'a', role: 'admin' } }
  const noTenant = { status: 'authenticated', user: { tenant_id: null,
    role: null, platform_role: 'superadmin' } }
  for (const auth of [viewer, operator, noTenant]) {
    assert.equal(getIamPermissions(auth).canViewUserAdmin, false)
  }
  assert.equal(getIamPermissions(admin).canViewUserAdmin, true)
  assert.equal(getIamPermissions({ ...viewer, user: { ...viewer.user,
    platform_role: 'superadmin', support_session: { tenant_id: 'a',
      access_level: 'read_only' } } }).canViewUserAdmin, false)
  assert.equal(getIamPermissions({ ...admin, user: { ...admin.user,
    platform_role: 'superadmin', support_session: { tenant_id: 'a',
      access_level: 'full' } } }).canViewUserAdmin, true)
})

test('IAM-4C mensajes de 429 y errores inciertos no prometen entrega', () => {
  assert.equal(invitationErrorMessage({ response: { status: 429,
    data: { detail: 'Esperá unos segundos.' } } }, 'resend'), 'Esperá unos segundos.')
  assert.match(invitationErrorMessage(new Error('network'), 'create'), /No se pudo confirmar/)
  assert.match(invitationErrorMessage({ response: { status: 404 } }, 'revoke'), /no pertenece/)
  assert.match(invitationErrorMessage({ response: { status: 409 } }, 'revoke'), /conflicto/)
  assert.match(invitationErrorMessage({ response: { status: 422 } }), /filtro o la paginación/)
})

test('IAM-4C presentación estática muestra pestañas y sólo pending tiene acciones', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const AuthContext = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).default
    const UserAdminPage = (await vite.ssrLoadModule('/src/pages/users/UserAdminPage.jsx')).default
    const { default: InvitationAdminPanel, InvitationRow } =
      await vite.ssrLoadModule('/src/pages/users/InvitationAdminPanel.jsx')
    const session = (role, tenantId = 'tenant-a') => ({ status: 'authenticated',
      contextId: `context-${tenantId}`, user: { id: 'self', role,
        tenant_id: tenantId, platform_role: null }, logout: async () => {} })
    const render = (auth, Component) => renderToStaticMarkup(createElement(
      AuthContext.Provider, { value: auth }, createElement(MemoryRouter, null,
        createElement(Component))))
    const page = render(session('admin'), UserAdminPage)
    assert.match(page, /Miembros/)
    assert.match(page, /Invitaciones/)
    assert.match(page, /Cargando miembros/)
    const panel = render(session('admin'), InvitationAdminPanel)
    assert.match(panel, /Crear invitación/)
    assert.match(panel, /Todos los estados/)
    assert.match(panel, /Cargando invitaciones/)
    assert.doesNotMatch(render(session('viewer'), InvitationAdminPanel), /Crear invitación/)
    assert.doesNotMatch(render(session('operator'), InvitationAdminPanel), /Crear invitación/)
    assert.doesNotMatch(render(session('admin', null), InvitationAdminPanel), /Crear invitación/)
    for (const status of ['pending', 'accepted', 'revoked', 'expired']) {
      const row = renderToStaticMarkup(createElement('table', null, createElement('tbody', null,
        createElement(InvitationRow, { invitation: invitation(status, status), pending: '',
          onResend: () => {}, onRevoke: () => {} }))))
      assert.equal(row.includes('Reenviar'), status === 'pending')
      assert.equal(row.includes('Revocar'), status === 'pending')
      assert.match(row, /example\.test/)
    }
    assert.doesNotMatch(panel, /token|password|Correo entregado/i)
  } finally {
    await vite.close()
  }
})
