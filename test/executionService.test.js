import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let vite
let apiClient
let executionService

before(async () => {
  vite = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } })
  apiClient = (await vite.ssrLoadModule('/src/services/api/client.js')).default
  executionService = (await vite.ssrLoadModule('/src/services/api/executionService.js')).default
})

after(async () => { await vite?.close() })

const integrationId = '05931e65-b6e0-4d7f-bfa9-bf0141f080f1'
const message = {
  trace_id: 'f7ded15d-3838-44cb-8015-389435868e00',
  tenant_id: '530203a4-d258-43d3-abdb-56f6d608127c',
  integration_id: integrationId,
  entity: 'sales_order',
  source_system: 'tiendanube',
  status: 'error',
  retries: 2,
  error_detail: { message: 'Producto no disponible' },
  created_at: '2026-10-05T10:00:00Z',
  updated_at: '2026-10-05T10:01:00Z',
}

test('no-argument consumers still receive normalized MessageStateResponse[] without a filter', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [message], status: 200 }))

  for (let i = 0; i < 2; i += 1) {
    const response = await executionService.listExecutions()
    assert.deepEqual(response.data, [message])
    assert.equal(response.status, 200)
  }
  for (const { arguments: [url, config] } of get.mock.calls) {
    assert.equal(url, '/executions')
    assert.deepEqual(config.params, {})
    assert.equal(apiClient.getUri({ url, ...config, baseURL: '' }), '/executions')
  }
})

test('Axios receives exactly integration_id as a string UUID and serializes it in the query', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [message] }))
  const response = await executionService.listExecutions({ integration_id: integrationId })
  const [url, config] = get.mock.calls[0].arguments

  assert.deepEqual(config.params, { integration_id: integrationId })
  assert.equal(typeof config.params.integration_id, 'string')
  assert.equal(apiClient.getUri({ url, ...config, baseURL: '' }), `/executions?integration_id=${integrationId}`)
  assert.deepEqual(response.data, [message])
})

for (const value of ['', null, undefined]) {
  test(`empty filter ${String(value)} is omitted entirely`, async (t) => {
    const get = t.mock.method(apiClient, 'get', async () => ({ data: [] }))
    await executionService.listExecutions({ integration_id: value })
    const [url, config] = get.mock.calls[0].arguments
    assert.equal('integration_id' in config.params, false)
    assert.equal(apiClient.getUri({ url, ...config, baseURL: '' }), '/executions')
  })
}

test('the service does not forward unrelated, tenant, search or pagination parameters', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [] }))
  await executionService.listExecutions({
    integration_id: integrationId,
    tenant_id: 'must-not-send',
    q: 'order', search: 'order', source_system: 'tiendanube', status: 'ok',
    page: 2, offset: 50, cursor: 'next', page_size: 50,
  })
  assert.deepEqual(get.mock.calls[0].arguments, ['/executions', { params: { integration_id: integrationId } }])
})

test('existing response envelopes still use the same execution adapter', async (t) => {
  t.mock.method(apiClient, 'get', async () => ({ data: { data: { items: [message] } } }))
  assert.deepEqual((await executionService.listExecutions()).data, [message])
})

test('HTTP errors propagate instead of becoming a successful empty response', async (t) => {
  const failure = new Error('HTTP 500')
  t.mock.method(apiClient, 'get', async () => { throw failure })
  await assert.rejects(executionService.listExecutions(), (error) => error === failure)
})

test('detail, logs and integration options keep their existing endpoints', async (t) => {
  const get = t.mock.method(apiClient, 'get', async () => ({ data: [] }))
  await executionService.getExecution(message.trace_id)
  await executionService.getExecutionLogs(message.trace_id)
  await executionService.listIntegrations()
  assert.deepEqual(get.mock.calls.map((call) => call.arguments), [
    [`/executions/${message.trace_id}`],
    [`/executions/${message.trace_id}/logs`],
    ['/integrations'],
  ])
})
