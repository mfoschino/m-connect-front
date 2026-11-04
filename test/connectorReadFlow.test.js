import assert from 'node:assert/strict'
import test from 'node:test'
import { createConnectorReadFlow, connectorReadError } from '../src/services/connectorReadFlow.js'
import { deferred, definition, installation } from './connectorFixtures.js'

const setup = (overrides = {}, tenantId = 'tenant-a') => {
  const changes = []
  const api = { listDefinitions: async () => ({ data: [definition()] }),
    listInstallations: async () => ({ data: [installation()] }),
    getInstallation: async (id) => ({ data: installation(id) }), ...overrides }
  const flow = createConnectorReadFlow({ api, tenantId, onChange: (state) => changes.push(state) })
  return { flow, changes }
}

test('carga listas independientes, incluye definiciones inactivas y permite vacío real', async () => {
  const calls = []
  const { flow } = setup({ listDefinitions: async (params, options) => {
    calls.push([params, options]); return { data: [] }
  }, listInstallations: async (params, options) => { calls.push([params, options]); return { data: [] } } })
  assert.equal(flow.getState().installations.loading, true)
  await Promise.all([flow.loadDefinitions(), flow.loadInstallations()])
  assert.deepEqual(calls.map(([params]) => params), [{ include_inactive: true }, {}])
  assert.ok(calls.every(([, options]) => options.signal instanceof AbortSignal))
  for (const resource of ['definitions', 'installations']) {
    assert.deepEqual(flow.getState()[resource], { data: [], loading: false, error: '' })
  }
})

test('el error de una lista no oculta la otra; retry es explícito y puede recuperar', async () => {
  let calls = 0
  const { flow } = setup({ listDefinitions: async () => {
    calls += 1
    if (calls === 1) throw { response: { status: 500, data: { detail: 'SECRET' } } }
    return { data: [definition()] }
  } })
  await Promise.all([flow.loadDefinitions(), flow.loadInstallations()])
  assert.equal(calls, 1)
  assert.equal(flow.getState().definitions.loading, false)
  assert.match(flow.getState().definitions.error, /No se pudo cargar/)
  assert.doesNotMatch(flow.getState().definitions.error, /SECRET/)
  assert.equal(flow.getState().installations.data.length, 1)
  await flow.loadDefinitions()
  assert.equal(calls, 2)
  assert.equal(flow.getState().definitions.error, '')
})

for (const outcome of ['success', 'failure']) {
  test(`recargar invalida una respuesta anterior (${outcome}) aunque ignore abort`, async () => {
    const old = deferred()
    let calls = 0
    let oldSignal
    const { flow } = setup({ listInstallations: async (_, { signal }) => {
      calls += 1
      if (calls === 1) { oldSignal = signal; return old.promise }
      return { data: [installation('new')] }
    } })
    const first = flow.loadInstallations()
    await flow.loadInstallations()
    assert.equal(oldSignal.aborted, true)
    if (outcome === 'success') old.resolve({ data: [installation('old')] })
    else old.reject({ response: { status: 403 } })
    await first
    assert.equal(flow.getState().installations.data[0].id, 'new')
    assert.equal(flow.getState().installations.error, '')
  })
}

for (const order of ['a-first', 'b-first', 'a-error']) {
  test(`detalle A → B conserva sólo B (${order})`, async () => {
    const a = deferred()
    const b = deferred()
    const signals = []
    const { flow } = setup({ getInstallation: (id, { signal }) => {
      signals.push(signal); return id === 'a' ? a.promise : b.promise
    } })
    const first = flow.openDetail('a')
    const second = flow.openDetail('b')
    assert.equal(signals[0].aborted, true)
    assert.equal(flow.getState().detail.data, null)
    if (order === 'a-first') {
      a.resolve({ data: installation('a') }); await first
      assert.equal(flow.getState().detail.loading, true)
      assert.equal(flow.getState().detail.id, 'b')
    }
    b.resolve({ data: installation('b') }); await second
    if (order === 'a-error') a.reject({ response: { status: 403 } })
    else a.resolve({ data: installation('a') })
    await first
    assert.equal(flow.getState().detail.data.id, 'b')
    assert.equal(flow.getState().detail.error, '')
  })
}

test('cerrar el detalle cancela su lectura e ignora respuestas y errores tardíos', async () => {
  const pending = deferred()
  let signal
  const { flow } = setup({ getInstallation: (_, options) => { signal = options.signal; return pending.promise } })
  const request = flow.openDetail('a')
  flow.closeDetail()
  assert.equal(signal.aborted, true)
  pending.reject(new Error('late'))
  await request
  assert.deepEqual(flow.getState().detail, { open: false, id: null, data: null, loading: false, error: '' })
})

test('404 de detalle no utiliza el snapshot del listado y permite reintentar', async () => {
  let calls = 0
  const { flow } = setup({ getInstallation: async (id) => {
    if (++calls === 1) throw { response: { status: 404 } }
    return { data: installation(id) }
  } })
  await flow.loadInstallations()
  await flow.openDetail('installation-a')
  assert.equal(flow.getState().detail.data, null)
  assert.match(flow.getState().detail.error, /no existe/)
  assert.equal(flow.getState().installations.data.length, 1)
  await flow.openDetail('installation-a')
  assert.equal(flow.getState().detail.data.id, 'installation-a')
})

for (const status of [401, 403]) {
  test(`${status} elimina datos y detalle e invalida otras lecturas en curso`, async () => {
    const pending = deferred()
    const { flow } = setup({ listDefinitions: () => pending.promise,
      getInstallation: async () => { throw { response: { status } } } })
    await flow.loadInstallations()
    const reading = flow.loadDefinitions()
    await flow.openDetail('installation-a')
    pending.resolve({ data: [definition()] })
    await reading
    assert.deepEqual(flow.getState().installations.data, [])
    assert.deepEqual(flow.getState().definitions.data, [])
    assert.equal(flow.getState().detail.open, false)
    assert.equal(flow.getState().definitions.loading, false)
    assert.ok(flow.getState().installations.error)
  })
}

test('no presenta instalaciones de otro tenant, definiciones privadas ajenas ni un detalle de otro ID', async () => {
  const { flow } = setup({
    listInstallations: async () => ({ data: [installation('a', { tenant_id: 'tenant-b' })] }),
    listDefinitions: async () => ({ data: [definition('a', { visibility: 'private', owner_tenant_id: 'tenant-b' })] }),
    getInstallation: async () => ({ data: installation('different') }),
  })
  await Promise.all([flow.loadInstallations(), flow.loadDefinitions()])
  assert.deepEqual(flow.getState().installations.data, [])
  assert.deepEqual(flow.getState().definitions.data, [])
  assert.ok(flow.getState().installations.error)
  await flow.openDetail('requested')
  assert.equal(flow.getState().detail.data, null)
  assert.ok(flow.getState().detail.error)
})

test('dispose limpia estado y aborta todo; el contexto nuevo no hereda datos ni respuestas viejas', async () => {
  const pending = deferred()
  const signals = []
  const old = setup({ listDefinitions: (_, options) => { signals.push(options.signal); return pending.promise },
    getInstallation: (_, options) => { signals.push(options.signal); return pending.promise } })
  await old.flow.loadInstallations()
  const list = old.flow.loadDefinitions()
  const detail = old.flow.openDetail('a')
  old.flow.dispose()
  const publications = old.changes.length
  const next = setup({ listInstallations: async () => ({ data: [installation('b', { tenant_id: 'tenant-b' })] }) }, 'tenant-b')
  assert.deepEqual(next.flow.getState().installations.data, [])
  assert.equal(next.flow.getState().detail.open, false)
  await next.flow.loadInstallations()
  pending.resolve({ data: installation('a') })
  await Promise.all([list, detail, old.flow.loadInstallations(), old.flow.openDetail('other')])
  assert.equal(old.changes.length, publications)
  assert.ok(signals.every((signal) => signal.aborted))
  assert.deepEqual(old.flow.getState().installations.data, [])
  assert.equal(next.flow.getState().installations.data[0].tenant_id, 'tenant-b')
})

test('sin tenant no se inicia ninguna lectura', async () => {
  let calls = 0
  const forbidden = () => { calls += 1; throw new Error('unexpected request') }
  const { flow } = setup({ listDefinitions: forbidden, listInstallations: forbidden, getInstallation: forbidden }, null)
  await Promise.all([flow.loadDefinitions(), flow.loadInstallations(), flow.openDetail('a')])
  assert.equal(calls, 0)
})

test('mensajes de error no presentan mensajes internos ni valores de inputs', () => {
  for (const status of [401, 403, 404, 422, 500, undefined]) {
    const message = connectorReadError({ message: 'SECRET', response: { status,
      data: { detail: [{ input: 'SECRET', msg: 'SECRET' }] } } }, 'detail')
    assert.doesNotMatch(message, /SECRET/)
    assert.ok(message)
  }
})
