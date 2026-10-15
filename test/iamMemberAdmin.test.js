import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'
import { createServer } from 'vite'
import { deferred } from './iamFixtures.js'
import { confirmedMemberResponse, confirmedRoleResponse, createMemberActionGate,
  memberMutationError, reactivationMessage } from '../src/services/memberAdminFlow.js'
import { createMemberReadFlow } from '../src/services/memberReadFlow.js'
import { installIamAxios } from '../src/services/auth/installIamAxios.js'

const member = (id, extra = {}) => ({ id, tenant_id: 'tenant-a', role: 'operator',
  is_active: true, email: `${id}@example.test`, ...extra })

test('IAM-4D gate bloquea dobles envíos y descarta contexto o rol antiguos', async () => {
  let allowed = false
  let current = true
  let calls = 0
  const pending = deferred()
  const changes = []
  const gate = createMemberActionGate({ isAllowed: () => allowed,
    isCurrent: () => current, onPendingChange: (value) => changes.push(value) })
  assert.equal((await gate.run('role:a', () => { calls += 1 }, 200)).kind, 'blocked')
  allowed = true
  const first = gate.run('role:a', () => { calls += 1; return pending.promise }, 200)
  assert.equal((await gate.run('role:a', () => { calls += 1 }, 200)).kind, 'blocked')
  assert.equal((await gate.run('disable:a', () => { calls += 1 }, 204)).kind, 'blocked')
  assert.equal(calls, 1)
  current = false
  pending.resolve({ status: 200, data: member('a') })
  assert.equal((await first).kind, 'stale')
  assert.deepEqual(changes, ['role:a'])
  gate.dispose()

  const late = deferred()
  const roleGate = createMemberActionGate({ isAllowed: () => allowed,
    isCurrent: () => true, onPendingChange: () => {} })
  const request = roleGate.run('reactivate:a', () => late.promise, 200)
  allowed = false
  late.resolve({ status: 200, data: member('a') })
  assert.equal((await request).kind, 'stale')
  assert.equal((await roleGate.run('reactivate:a', () => { calls += 1 }, 200)).kind, 'blocked')
  roleGate.dispose()

  allowed = true
  const disable = deferred()
  const disposeGate = createMemberActionGate({ isAllowed: () => allowed,
    isCurrent: () => true, onPendingChange: () => {} })
  const disabling = disposeGate.run('disable:a', () => { calls += 1; return disable.promise }, 204)
  assert.equal((await disposeGate.run('disable:a', () => { calls += 1 }, 204)).kind,
    'blocked')
  disposeGate.dispose()
  disable.resolve({ status: 204 })
  assert.equal((await disabling).kind, 'stale')
  assert.equal(calls, 2)
})

test('IAM-4D confirma identidad y estado efectivo sin inferir causa de inactividad', () => {
  const inactive = member('a', { is_active: false })
  assert.equal(confirmedMemberResponse({ data: inactive }, inactive), true)
  assert.equal(confirmedRoleResponse({ data: member('a', { role: 'viewer' }) },
    inactive, 'viewer'), true)
  assert.equal(confirmedRoleResponse({ data: inactive }, inactive, 'viewer'), false)
  assert.equal(confirmedMemberResponse({ data: member('a', { tenant_id: 'tenant-b' }) },
    inactive), false)
  assert.equal(confirmedMemberResponse({ data: { id: 'a', tenant_id: 'tenant-a' } },
    inactive), false)
  assert.match(reactivationMessage(inactive), /sigue inactivo/)
  assert.doesNotMatch(reactivationMessage(inactive), /acceso efectivo está activo/)
  assert.match(reactivationMessage(member('a')), /acceso efectivo está activo/)
  assert.match(memberMutationError({ response: { status: 409 } }, 'el cambio'),
    /conservar al menos un administrador activo/)
  assert.match(memberMutationError({ response: { status: 403,
    data: { detail: 'No podés cambiar tu propio rol.' } } }, 'el cambio'), /propio rol/)
  assert.match(memberMutationError({ response: { status: 403,
    data: { detail: 'No podés desactivar tu propia cuenta.' } } }, 'la baja'), /propio acceso/)
  assert.match(memberMutationError({ response: { status: 404 } }, 'el cambio'), /no pertenece/)
  assert.match(memberMutationError({ response: { status: 422 } }, 'el cambio'), /no son válidos/)
  assert.match(memberMutationError(new Error('network'), 'la baja'), /Refrescá/)
})

test('IAM-4D refresca primera página y detalle abierto con el filtro vigente', async () => {
  const listCalls = []
  const detailCalls = []
  let updated = false
  const flow = createMemberReadFlow({ limit: 2,
    listMembers: async (options) => {
      listCalls.push(options)
      return { data: updated ? [member('a', { is_active: false })]
        : [member('a'), member('b')] }
    },
    getMember: async (id) => {
      detailCalls.push(id)
      return { data: member(id, { is_active: !updated }) }
    },
    onChange: () => {},
  })
  await flow.refresh(true)
  await flow.openDetail('a')
  updated = true
  await flow.refreshAfterMutation()
  assert.deepEqual(listCalls.map((call) => [call.skip, call.include_disabled]),
    [[0, true], [0, true]])
  assert.deepEqual(flow.getState().members.map((row) => row.id), ['a'])
  assert.equal(flow.getState().nextSkip, 1)
  assert.equal(flow.getState().detail.open, true)
  assert.equal(flow.getState().detail.member.is_active, false)
  assert.deepEqual(detailCalls, ['a', 'a'])
  flow.closeDetail()
  await flow.refreshAfterMutation()
  assert.equal(flow.getState().detail.open, false)
  assert.deepEqual(detailCalls, ['a', 'a'])
  flow.dispose()
})

test('IAM-4D servicio con interceptor real no repite PATCH ni DELETE tras 401', async () => {
  const vite = await createServer({ appType: 'custom', logLevel: 'silent',
    configLoader: 'runner', server: { middlewareMode: true } })
  let uninstall
  try {
    const service = (await vite.ssrLoadModule('/src/services/api/userAdminService.js')).default
    const client = (await vite.ssrLoadModule('/src/services/api/client.js')).default
    const base = 'https://api.example.test'
    let token = 'access-one'
    let contextId = 'tenant-a'
    let revision = 1
    let refreshes = 0
    let revalidations = 0
    let mode = 401
    const calls = []
    const late = deferred()
    const lateStarted = deferred()
    const fail = (config, status) => Promise.reject(new axios.AxiosError(
      `HTTP ${status}`, axios.AxiosError.ERR_BAD_RESPONSE, config, null,
      { config, status, data: null, statusText: String(status), headers: {} }))
    client.defaults.baseURL = base
    client.defaults.adapter = (config) => {
      calls.push(config)
      if (mode === 'late') { lateStarted.resolve(); return late.promise }
      if (mode === 'network') {
        return Promise.reject(new axios.AxiosError('Network Error',
          axios.AxiosError.ERR_NETWORK, config))
      }
      if (typeof mode === 'number') return fail(config, mode)
      if (mode === 'get-401' && calls.length === 1) return fail(config, 401)
      return Promise.resolve({ config, status: config.method === 'delete' ? 204 : 200,
        data: config.method === 'delete' ? undefined
          : config.method === 'get' ? [] : member('a'), headers: {} })
    }
    const manager = {
      getAccessToken: () => token,
      getState: () => ({ status: 'tokens_available' }),
      getContextSnapshot: () => ({ contextId, generation: 1, tokenRevision: revision }),
      isSameContext: (snapshot) => snapshot.contextId === contextId,
      refresh: async () => {
        refreshes += 1
        revision += 1
        token = `access-${refreshes + 1}`
        return token
      },
      invalidateRejected: async () => true,
    }
    uninstall = installIamAxios(client, { manager, apiBaseUrl: base,
      onForbidden: async () => { revalidations += 1 } })

    for (const operation of [
      () => service.updateUser('a', { role: 'admin' }),
      () => service.deactivateUser('a'),
    ]) {
      calls.length = 0
      await assert.rejects(operation(), (error) => error.response?.status === 401)
      assert.equal(calls.length, 1)
      assert.equal(calls[0]._iamSkipAuthRetry, true)
      assert.equal(calls[0].headers.get('_iamSkipAuthRetry'), undefined)
    }
    assert.equal(refreshes, 2)

    mode = 'success'
    calls.length = 0
    const changed = await service.updateUser('a', { role: 'viewer', full_name: 'Ana',
      is_active: true, tenant_id: 'ignored', password: 'ignored' })
    assert.equal(changed.status, 200)
    assert.equal(calls.length, 1)
    assert.deepEqual(JSON.parse(calls[0].data),
      { full_name: 'Ana', role: 'viewer', is_active: true })
    calls.length = 0
    assert.equal((await service.reactivateUser('a')).status, 200)
    assert.deepEqual(JSON.parse(calls[0].data), { is_active: true })
    calls.length = 0
    const disabled = await service.deactivateUser('a')
    assert.equal(disabled.status, 204)
    assert.equal(disabled.data, undefined)
    assert.equal(calls[0].data, undefined)

    token = null
    calls.length = 0
    assert.equal((await service.updateUser('a', { role: 'viewer' })).status, 200)
    assert.equal(calls.length, 1)
    assert.match(calls[0].headers.get('Authorization'), /^Bearer access-/)

    mode = 'get-401'
    calls.length = 0
    assert.equal((await service.listUsers()).status, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls.every((config) => config.method === 'get'
      && !config._iamSkipAuthRetry), true)

    for (const status of [403, 404, 409, 422, 503]) {
      mode = status
      calls.length = 0
      await assert.rejects(service.updateUser('a', { role: 'viewer' }),
        (error) => error.response?.status === status)
      assert.equal(calls.length, 1)
    }
    assert.equal(revalidations, 1)

    mode = 'network'
    calls.length = 0
    await assert.rejects(service.deactivateUser('a'), (error) => error.code === 'ERR_NETWORK')
    assert.equal(calls.length, 1)

    mode = 'late'
    calls.length = 0
    const pending = service.updateUser('a', { role: 'operator' })
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
