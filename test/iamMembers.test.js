import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createServer } from 'vite'
import { deferred } from './iamFixtures.js'
import { createMemberReadFlow, memberReadError } from '../src/services/memberReadFlow.js'
import { routeDecision } from '../src/services/auth/iamRoutePolicy.js'

const member = (id, extra = {}) => ({ id, email: `${id}@example.test`, full_name: id,
  role: 'viewer', tenant_id: 'tenant-a', is_active: true, is_verified: true,
  last_login: null, created_at: null, ...extra })

const setupFlow = ({ listMembers = async () => ({ data: [] }),
  getMember = async (id) => ({ data: member(id) }), limit = 2 } = {}) => {
  const snapshots = []
  const flow = createMemberReadFlow({ listMembers, getMember, limit,
    onChange: (state) => snapshots.push(state) })
  return { flow, snapshots }
}

test('IAM-4B lee miembros y detalle por rutas canónicas; escrituras legacy permanecen', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const service = (await vite.ssrLoadModule('/src/services/api/userAdminService.js')).default
    const client = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const calls = []
    client.defaults.adapter = async (config) => {
      calls.push({ method: config.method, url: config.url, params: config.params })
      return { config, status: 200, data: [], headers: {} }
    }
    await service.listUsers()
    await service.listUsers({ skip: 50, limit: 25, include_disabled: true, tenant_id: 'ignored' })
    await service.getUser('member-id')
    await service.updateUser('member-id', { role: 'operator' })
    await service.deactivateUser('member-id')
    assert.deepEqual(calls, [
      { method: 'get', url: '/tenant/members',
        params: { skip: 0, limit: 50, include_disabled: false } },
      { method: 'get', url: '/tenant/members',
        params: { skip: 50, limit: 25, include_disabled: true } },
      { method: 'get', url: '/tenant/members/member-id', params: undefined },
      { method: 'put', url: '/users/member-id', params: undefined },
      { method: 'delete', url: '/users/member-id', params: undefined },
    ])
    assert.equal('createUser' in service, false)
    for (const status of [403, 404]) {
      client.defaults.adapter = async () => { throw { response: { status } } }
      await assert.rejects(service.getUser('member-id'), (error) => error.response.status === status)
    }
    client.defaults.adapter = async () => { throw new Error('Network Error') }
    await assert.rejects(service.listUsers(), /Network Error/)
  } finally {
    await vite.close()
  }
})

test('IAM-4B paginación sin total: vacío, página exacta, deduplicación y solicitudes simultáneas', async () => {
  const pending = deferred()
  const calls = []
  const { flow } = setupFlow({ listMembers: (options) => {
    calls.push(options)
    if (calls.length === 1) return pending.promise
    if (calls.length === 2) return Promise.resolve({ data: [member('b'), member('c')] })
    return Promise.resolve({ data: [] })
  } })
  const first = flow.refresh()
  await flow.loadMore()
  assert.equal(calls.length, 1)
  pending.resolve({ data: [member('a'), member('b')] })
  await first
  assert.equal(flow.getState().hasMore, true)
  await flow.loadMore()
  assert.deepEqual(flow.getState().members.map((row) => row.id), ['a', 'b', 'c'])
  assert.equal(flow.getState().nextSkip, 4)
  await flow.loadMore()
  assert.equal(flow.getState().hasMore, false)
  assert.deepEqual(calls.map((call) => call.skip), [0, 2, 4])
  await flow.loadMore()
  assert.equal(calls.length, 3)
  flow.dispose()

  const empty = setupFlow()
  await empty.flow.refresh()
  assert.deepEqual(empty.flow.getState().members, [])
  assert.equal(empty.flow.getState().hasMore, false)
  empty.flow.dispose()
})

test('IAM-4B filtro, refresco y cambio de tenant descartan respuestas antiguas', async () => {
  const old = deferred()
  const fresh = deferred()
  const calls = []
  const { flow, snapshots } = setupFlow({ listMembers: (options) => {
    calls.push(options)
    return calls.length === 1 ? old.promise : fresh.promise
  } })
  const first = flow.refresh()
  const filtered = flow.setIncludeDisabled(true)
  assert.deepEqual(calls.map((call) => call.include_disabled), [false, true])
  assert.equal(flow.getState().nextSkip, 0)
  assert.deepEqual(flow.getState().members, [])
  old.resolve({ data: [member('tenant-a')] })
  await first
  assert.deepEqual(flow.getState().members, [])
  fresh.resolve({ data: [member('tenant-b')] })
  await filtered
  assert.deepEqual(flow.getState().members.map((row) => row.id), ['tenant-b'])
  const oldCount = snapshots.length
  flow.dispose()
  await flow.refresh()
  assert.equal(snapshots.length, oldCount)

  const late = deferred()
  const separate = setupFlow({ listMembers: () => late.promise })
  const read = separate.flow.refresh()
  separate.flow.dispose()
  late.resolve({ data: [member('tenant-a')] })
  await read
  assert.deepEqual(separate.flow.getState().members, [])
  assert.equal(separate.snapshots.at(-1).members.length, 0)
})

test('IAM-4B refresco reinicia skip y no mezcla páginas previas', async () => {
  const calls = []
  const { flow } = setupFlow({ listMembers: async (options) => {
    calls.push(options)
    return { data: calls.length === 1 ? [member('a'), member('b')] : [member('c')] }
  } })
  await flow.refresh()
  await flow.refresh()
  assert.deepEqual(calls.map((call) => call.skip), [0, 0])
  assert.deepEqual(flow.getState().members.map((row) => row.id), ['c'])
  flow.dispose()
})

test('IAM-4B detalle ignora cambio rápido, cierre y respuesta tardía', async () => {
  const a = deferred()
  const b = deferred()
  const detailCalls = []
  const { flow } = setupFlow({ getMember: (id) => {
    detailCalls.push(id)
    return id === 'a' ? a.promise : b.promise
  } })
  const readA = flow.openDetail('a')
  await flow.openDetail('a')
  const readB = flow.openDetail('b')
  assert.deepEqual(detailCalls, ['a', 'b'])
  a.resolve({ data: member('a') })
  await readA
  assert.equal(flow.getState().detail.member, null)
  b.resolve({ data: member('b') })
  await readB
  assert.equal(flow.getState().detail.member.id, 'b')
  flow.closeDetail()
  assert.equal(flow.getState().detail.open, false)
  assert.equal(flow.getState().detail.member, null)
  flow.dispose()
})

test('IAM-4B 403 borra datos anteriores; 404 y errores de red son recuperables', async () => {
  let call = 0
  const { flow } = setupFlow({ listMembers: async () => {
    call += 1
    if (call === 1) return { data: [member('a'), member('b')] }
    if (call === 2) throw { response: { status: 403 } }
    return { data: [member('c')] }
  }, getMember: async () => { throw { response: { status: 404 } } } })
  await flow.refresh()
  await flow.loadMore()
  assert.deepEqual(flow.getState().members, [])
  assert.match(flow.getState().error, /permiso/)
  await flow.refresh()
  assert.deepEqual(flow.getState().members.map((row) => row.id), ['c'])
  await flow.openDetail('missing')
  assert.match(flow.getState().detail.error, /no pertenece/)
  assert.equal(flow.getState().detail.member, null)
  assert.match(memberReadError({ response: { status: 422 } }), /inválidos/)
  assert.match(memberReadError(new Error('network')), /Intentá nuevamente/)
  flow.dispose()
})

test('IAM-4B 403 en detalle invalida también el listado visible', async () => {
  const { flow } = setupFlow({ listMembers: async () => ({ data: [member('a')] }),
    getMember: async () => { throw { response: { status: 403 } } } })
  await flow.refresh()
  assert.equal(flow.getState().members.length, 1)
  await flow.openDetail('a')
  assert.deepEqual(flow.getState().members, [])
  assert.match(flow.getState().error, /permiso/)
  assert.match(flow.getState().detail.error, /permiso/)
  flow.dispose()
})

test('IAM-4B presentación estática identifica acceso efectivo y no infiere invitaciones', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  try {
    const AuthContext = (await vite.ssrLoadModule('/src/context/AuthContext.jsx')).default
    const { default: UserAdminPage, MemberAccessBadge, MemberDetailContent, MemberRow } =
      await vite.ssrLoadModule('/src/pages/users/UserAdminPage.jsx')
    const ProtectedRoute = (await vite.ssrLoadModule('/src/components/common/ProtectedRoute.jsx')).default
    const render = (role, tenantId = 'tenant-a', support = null) => {
      const auth = { status: 'authenticated', contextId: `context-${tenantId}`,
        user: { id: 'self', email: 'self@example.test', role, tenant_id: tenantId,
          platform_role: support ? 'superadmin' : null, support_session: support },
        logout: async () => {} }
      return renderToStaticMarkup(createElement(AuthContext.Provider, { value: auth },
        createElement(MemoryRouter, null, createElement(ProtectedRoute,
          { allowedRoles: ['admin'] }, createElement(UserAdminPage)))))
    }
    assert.match(render('admin'), /Miembros e invitaciones de la organización/)
    assert.match(render('admin'), /Incluir miembros inactivos/)
    assert.match(render('admin'), /Cargando miembros/)
    assert.match(render('admin'), /Último inicio de sesión \(global\)/)
    assert.doesNotMatch(render('admin'), /Invitaciones pendientes/)
    for (const role of ['viewer', 'operator']) assert.match(render(role), /No tenés permiso/)
    assert.match(render('admin', null), /organizaci[oó]n|tenant/i)
    assert.match(render('viewer', 'tenant-a', { access_level: 'read_only' }), /No tenés permiso/)
    assert.match(render('admin', 'tenant-a', { access_level: 'full' }), /Miembros/)
    assert.equal(routeDecision({ status: 'authenticated', user: {
      tenant_id: null, role: null, platform_role: 'superadmin' } }, ['admin']), 'no_tenant')
    const active = renderToStaticMarkup(createElement(MemberAccessBadge, { member: member('a') }))
    const inactive = renderToStaticMarkup(createElement(MemberAccessBadge,
      { member: member('b', { is_active: false, is_verified: false }) }))
    assert.match(active, /Acceso activo/)
    assert.match(inactive, /Acceso inactivo/)
    assert.doesNotMatch(inactive, /Pendiente|Invitada|Suspendida|Bloqueada/)
    const detail = renderToStaticMarkup(createElement(MemberDetailContent,
      { member: member('b', { is_active: false, is_verified: false }) }))
    assert.match(detail, /Rol en esta organización/)
    assert.match(detail, /Correo verificado/)
    assert.match(detail, /Último inicio de sesión \(global\)/)
    assert.doesNotMatch(detail, /Invitada|Pendiente/)
    const rows = renderToStaticMarkup(createElement('table', null, createElement('tbody', null,
      createElement(MemberRow, { record: member('a'), onRoleChange: () => {},
        onDeactivate: () => {}, onDetail: () => {} }),
      createElement(MemberRow, { record: member('b', { is_active: false,
        is_verified: false }), onRoleChange: () => {}, onDeactivate: () => {},
        onDetail: () => {} }))))
    assert.match(rows, /a@example\.test/)
    assert.match(rows, /b@example\.test/)
    assert.match(rows, /Acceso activo/)
    assert.match(rows, /Acceso inactivo/)
    assert.match(rows, /Ver detalle/)
    assert.equal((rows.match(/Deshabilitar acceso/g) || []).length, 2)
    assert.doesNotMatch(rows, /Invitada|Pendiente/)
  } finally {
    await vite.close()
  }
})
