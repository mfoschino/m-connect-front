import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import { definition, installation } from './connectorFixtures.js'

let vite
let apiClient
let service
before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', configLoader: 'runner',
    server: { middlewareMode: true } })
  apiClient = (await vite.ssrLoadModule('/src/services/api/client.js')).default
  service = (await vite.ssrLoadModule('/src/services/api/connectorService.js')).default
})
after(async () => { await vite?.close() })

test('definiciones usa el cliente compartido y únicamente kind/include_inactive, conservando false', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ status: 200, data: [definition()] }))
  const signal = new AbortController().signal
  const response = await service.listDefinitions({ kind: 'input', include_inactive: false,
    tenant_id: 'DO-NOT-SEND', search: 'name', page: 2 }, { signal })
  assert.equal(response.status, 200)
  assert.equal(response.data[0].code, null)
  assert.deepEqual(get.mock.calls[0].arguments, ['/connector-definitions', {
    params: { kind: 'input', include_inactive: false }, signal,
  }])
  await service.listDefinitions()
  assert.deepEqual(get.mock.calls[1].arguments[1].params, {})
  await service.listDefinitions({ include_inactive: true })
  assert.deepEqual(get.mock.calls[2].arguments[1].params, { include_inactive: true })
})

test('instalaciones acepta sólo kind/connector_definition_id y no envía filtros de presentación', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [installation()] }))
  const id = 'a2f90bb2-af1b-44d5-aec3-456a5f0300ac'
  await service.listInstallations({ kind: 'output', connector_definition_id: id,
    include_inactive: true, is_active: false, tenant_id: 'DO-NOT-SEND', q: 'foo', limit: 20 })
  assert.deepEqual(get.mock.calls[0].arguments[1].params, { kind: 'output', connector_definition_id: id })
  for (const kind of ['', undefined, null]) {
    await service.listInstallations({ kind, connector_definition_id: '' })
    assert.deepEqual(get.mock.calls.at(-1).arguments[1].params, {})
  }
  assert.ok(get.mock.calls.every((call) => call.arguments[0] === '/connector-installations'))
})

test('detalle usa el ID codificado y propaga cancelación; no expone configuración', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: installation('a', {
    config: { password: 'SECRET' }, secrets: { auth_token: 'SECRET' },
  }) }))
  const signal = new AbortController().signal
  const result = await service.getInstallation('a/b', { signal })
  assert.deepEqual(get.mock.calls[0].arguments, ['/connector-installations/a%2Fb', { signal }])
  assert.doesNotMatch(JSON.stringify(result.data), /SECRET|config/)
  await assert.rejects(service.getInstallation(''))
})

test('errores HTTP y respuestas inválidas no se convierten en listas vacías exitosas', async (t) => {
  const failure = { response: { status: 403, data: { detail: 'internal' } } }
  const get = t.mock.method(apiClient, 'get', async () => { throw failure })
  await assert.rejects(service.listDefinitions(), (error) => error === failure)
  get.mock.mockImplementation(async () => ({ data: { items: [] } }))
  await assert.rejects(service.listInstallations())
  await assert.rejects(service.listDefinitions({ kind: 'all' }))
  await assert.rejects(service.listDefinitions({ include_inactive: 'false' }))
})

test('la superficie pública y todas sus solicitudes son exclusivamente GET', async () => {
  assert.deepEqual(Object.keys(service).sort(), ['getInstallation', 'listDefinitions', 'listInstallations'])
  const calls = []
  const originalAdapter = apiClient.defaults.adapter
  apiClient.defaults.adapter = async (config) => {
    calls.push(config)
    return { status: 200, statusText: 'OK', headers: {}, config,
      data: config.url === '/connector-definitions' ? [definition()]
      : config.url === '/connector-installations' ? [installation()] : installation() }
  }
  try {
    await service.listDefinitions()
    await service.listInstallations()
    await service.getInstallation('installation-a')
  } finally {
    apiClient.defaults.adapter = originalAdapter
  }
  assert.deepEqual(calls.map(({ method, url }) => [method, url]), [
    ['get', '/connector-definitions'], ['get', '/connector-installations'], ['get', '/connector-installations/installation-a'],
  ])
})
