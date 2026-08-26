import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExecutionIdentifier,
  normalizeExecutionsResponse,
} from '../src/services/adapters/executionAdapter.js'
import {
  buildBackendIntegrationPayload,
  getActiveCompatibleProfiles,
} from '../src/services/adapters/integrationFlowAdapter.js'

const executions = [
  { trace_id: 'trace-1', status: 'ok' },
  { id: 'execution-2' },
]

test('normalizes a direct executions array', () => {
  assert.deepEqual(normalizeExecutionsResponse(executions), executions)
})

for (const key of ['items', 'executions', 'data']) {
  test(`normalizes executions under ${key}`, () => {
    assert.deepEqual(normalizeExecutionsResponse({ [key]: executions }), executions)
  })
}

test('normalizes nested Axios-style data envelopes', () => {
  assert.deepEqual(
    normalizeExecutionsResponse({ data: { items: executions } }),
    executions,
  )
})

for (const value of [null, undefined, {}, { items: null }, 'invalid']) {
  test(`normalizes ${String(value)} to an empty array`, () => {
    assert.deepEqual(normalizeExecutionsResponse(value), [])
  })
}

test('execution identifiers tolerate missing fields', () => {
  assert.equal(getExecutionIdentifier({ trace_id: 'trace-id' }), 'trace-id')
  assert.equal(getExecutionIdentifier({ id: 'execution-id' }), 'execution-id')
  assert.equal(getExecutionIdentifier({ task_id: 'task-id' }), 'task-id')
  assert.equal(getExecutionIdentifier({ status: 'pending' }), '')
  assert.equal(getExecutionIdentifier(null), '')
})

test('invalid execution entries are discarded without hiding valid rows', () => {
  assert.deepEqual(
    normalizeExecutionsResponse([null, executions[0], 'invalid']),
    [executions[0]],
  )
})

test('compatible profiles come only from active real profile data', () => {
  const profiles = [
    { id: 'inbound-active', source_system: 'tiendanube', entity: 'sales_order', is_active: true },
    { id: 'inbound-inactive', source_system: 'tiendanube', entity: 'sales_order', is_active: false },
    { id: 'other-entity', source_system: 'tiendanube', entity: 'customer', is_active: true },
  ]

  assert.deepEqual(
    getActiveCompatibleProfiles(profiles, 'tiendanube', 'sales_order').map((profile) => profile.id),
    ['inbound-active'],
  )
  assert.deepEqual(getActiveCompatibleProfiles(null, 'tiendanube', 'sales_order'), [])
})

test('integration payload never persists profile ids or forbidden relationship fields', () => {
  const payload = buildBackendIntegrationPayload({
    name: 'Tienda Nube',
    connector_type: 'api',
    source_entity: 'sales_order',
    source_system: 'tiendanube',
    finnegans_document: 'pedido_venta',
    config: {
      endpoint: '/orders',
      inbound_profile_id: 'legacy-inbound-id',
      outbound_profile_id: 'legacy-outbound-id',
      profile_id: 'legacy-profile-id',
      profiles: [{ id: 'legacy-profile' }],
      suggested_profiles: ['legacy-profile'],
    },
    inbound_profile_id: 'inbound-id',
    outbound_profile_id: 'outbound-id',
    profile_id: 'profile-id',
    direction: 'inbound',
    destination_system: 'finnegans',
    target_system: 'finnegans',
    metadata: { suggested: true },
    is_active: true,
  })

  assert.deepEqual(Object.keys(payload), [
    'name',
    'source_entity',
    'connector_type',
    'config',
    'schedule',
    'is_active',
  ])

  for (const field of [
    'inbound_profile_id',
    'outbound_profile_id',
    'profile_id',
    'direction',
    'destination_system',
    'target_system',
    'metadata',
    'profiles',
    'suggested_profiles',
  ]) {
    assert.equal(field in payload, false)
    assert.equal(field in payload.config, false)
  }
})
