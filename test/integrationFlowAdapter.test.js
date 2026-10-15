import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBackendIntegrationPayload,
  getInboundProfileCandidates,
  getOutboundProfileCandidates,
  getOutboundProfileSourceSystem,
  mapBackendIntegrationToDesign,
} from '../src/services/adapters/integrationFlowAdapter.js'
import { getSafeIntegrationReviewConfig } from '../src/services/adapters/integrationReviewAdapter.js'

const inboundProfile = (overrides = {}) => ({
  id: 'inbound-1',
  source_system: 'tiendanube',
  entity: 'sales_order',
  version: '1.0.0',
  is_active: true,
  config: [],
  ...overrides,
})

const outboundProfile = (overrides = {}) => ({
  id: 'outbound-1',
  source_system: 'finnegans',
  entity: 'sales_order',
  version: '1.0.0',
  is_active: true,
  config: [],
  ...overrides,
})

test('inbound returns zero candidates when no active profile is compatible', () => {
  assert.deepEqual(
    getInboundProfileCandidates([], 'tiendanube', 'sales_order'),
    [],
  )
})

test('inbound returns exactly one compatible active profile', () => {
  const expected = inboundProfile()

  assert.deepEqual(
    getInboundProfileCandidates([expected], 'tiendanube', 'sales_order'),
    [expected],
  )
})

test('inbound accepts the source_entity and active aliases produced by the profile adapter', () => {
  const normalizedProfile = {
    id: 'normalized-inbound',
    source_system: 'tiendanube',
    source_entity: 'sales_order',
    active: true,
    config: [],
  }

  assert.deepEqual(
    getInboundProfileCandidates([normalizedProfile], 'tiendanube', 'sales_order'),
    [normalizedProfile],
  )
})

test('inbound preserves all compatible candidates without choosing a version', () => {
  const first = inboundProfile({ id: 'inbound-v1', version: '1.0.0' })
  const second = inboundProfile({ id: 'inbound-v2', version: '2.0.0' })

  assert.deepEqual(
    getInboundProfileCandidates([first, second], 'tiendanube', 'sales_order'),
    [first, second],
  )
})

test('inbound ignores inactive profiles and profiles from another entity or source system', () => {
  const compatible = inboundProfile()
  const profiles = [
    inboundProfile({ id: 'inactive', is_active: false }),
    inboundProfile({ id: 'other-entity', entity: 'customer' }),
    inboundProfile({ id: 'other-source', source_system: 'shopify' }),
    compatible,
  ]

  assert.deepEqual(
    getInboundProfileCandidates(profiles, 'tiendanube', 'sales_order'),
    [compatible],
  )
})

test('outbound keeps the existing Pedido de Venta and Punto de Venta conventions', () => {
  assert.equal(getOutboundProfileSourceSystem('pedido_venta', 'sales_order'), 'finnegans')
  assert.equal(getOutboundProfileSourceSystem('punto_venta', 'sales_order'), 'finnegans_punto_venta')

  const pedidoVenta = outboundProfile({ id: 'pedido-venta' })
  const puntoVenta = outboundProfile({
    id: 'punto-venta',
    source_system: 'finnegans_punto_venta',
  })

  assert.deepEqual(
    getOutboundProfileCandidates(
      [pedidoVenta, puntoVenta],
      'pedido_venta',
      'sales_order',
    ),
    [pedidoVenta],
  )
  assert.deepEqual(
    getOutboundProfileCandidates(
      [pedidoVenta, puntoVenta],
      'punto_venta',
      'sales_order',
    ),
    [puntoVenta],
  )
})

test('outbound exposes zero, one or multiple compatible candidates without selecting one', () => {
  const first = outboundProfile({ id: 'outbound-v1', version: '1.0.0' })
  const second = outboundProfile({ id: 'outbound-v2', version: '2.0.0' })

  assert.deepEqual(
    getOutboundProfileCandidates([], 'pedido_venta', 'sales_order'),
    [],
  )
  assert.deepEqual(
    getOutboundProfileCandidates([first], 'pedido_venta', 'sales_order'),
    [first],
  )
  assert.deepEqual(
    getOutboundProfileCandidates([first, second], 'pedido_venta', 'sales_order'),
    [first, second],
  )
})

test('outbound ignores inactive profiles and profiles from another entity or source system', () => {
  const compatible = outboundProfile()
  const profiles = [
    outboundProfile({ id: 'inactive', is_active: false }),
    outboundProfile({ id: 'other-entity', entity: 'customer' }),
    outboundProfile({ id: 'other-source', source_system: 'finnegans_punto_venta' }),
    compatible,
  ]

  assert.deepEqual(
    getOutboundProfileCandidates(profiles, 'pedido_venta', 'sales_order'),
    [compatible],
  )
})

test('editing preserves legacy config.field_mappings and unknown config fields', () => {
  const backendIntegration = {
    name: 'Integración existente',
    source_entity: 'sales_order',
    connector_type: 'api',
    config: {
      source_system: 'tiendanube',
      base_url: 'https://api.example.test',
      custom_runtime_option: { preserve: true },
      field_mappings: [
        {
          source_field: 'status',
          target_field: 'legacy_status',
          field_type: 'lookup',
          lookup_table_name: 'LegacyStatusMap',
          on_error: 'skip',
        },
        {
          source_field: '**constant**',
          target_field: 'legacy_constant',
          field_type: 'constant',
          value: 'kept',
          on_error: 'fail',
        },
      ],
    },
    schedule: null,
    is_active: true,
  }
  const design = mapBackendIntegrationToDesign(backendIntegration)
  const payload = buildBackendIntegrationPayload({
    ...design,
    source_system: design.source_system_id,
    field_mappings: design.config.field_mappings,
  })

  assert.deepEqual(payload.config.custom_runtime_option, { preserve: true })
  assert.deepEqual(payload.config.field_mappings, [
    {
      source_field: 'status',
      target_field: 'legacy_status',
      field_type: 'lookup',
      lookup_table_code: 'LegacyStatusMap',
      on_error: 'skip',
    },
    {
      source_field: '**constant**',
      target_field: 'legacy_constant',
      field_type: 'constant',
      value: 'kept',
      on_error: 'fail',
    },
  ])
})

test('Review sanitization is visual only and the payload keeps original config values', () => {
  const originalConfig = {
    source_system: 'tiendanube',
    endpoint: '/orders?access_token=embedded-secret&limit=20',
    base_url: 'https://demo-user:demo-password@example.test',
    access_token: 'real-access-token',
    api_key: 'real-api-key',
    headers: {
      Authentication: 'bearer real-header-token',
      'Content-Type': 'application/json',
      'X-Custom-Authorization': 'Bearer neutral-header-secret',
    },
    unknown_option: { keep: true },
    field_mappings: [
      { source_field: 'legacy', target_field: 'legacy', field_type: 'simple' },
    ],
  }
  const originalSnapshot = structuredClone(originalConfig)
  const safeConfig = getSafeIntegrationReviewConfig(originalConfig)
  const payload = buildBackendIntegrationPayload({
    name: 'Integración segura',
    source_entity: 'sales_order',
    connector_type: 'api',
    source_system: 'tiendanube',
    finnegans_document: 'pedido_venta',
    config: originalConfig,
    field_mappings: originalConfig.field_mappings,
    profile_id: 'must-not-leak',
    inbound_profile_id: 'must-not-leak',
    outbound_profile_id: 'must-not-leak',
    profile_candidates: ['must-not-leak'],
    review_state: { mustNotLeak: true },
    sanitized_config: safeConfig,
  })

  assert.deepEqual(originalConfig, originalSnapshot)
  assert.equal(safeConfig.access_token, '[configurado]')
  assert.equal(safeConfig.api_key, '[configurado]')
  assert.equal(safeConfig.headers.Authentication, '[configurado]')
  assert.equal(safeConfig.headers['Content-Type'], 'application/json')
  assert.equal(safeConfig.headers['X-Custom-Authorization'], '[configurado]')
  assert.equal(safeConfig.endpoint, '/orders?access_token=[configurado]&limit=20')
  assert.equal(safeConfig.base_url, 'https://[configurado]@example.test')
  assert.equal('field_mappings' in safeConfig, false)

  assert.equal(payload.config.access_token, 'real-access-token')
  assert.equal(payload.config.api_key, 'real-api-key')
  assert.equal(payload.config.headers.Authentication, 'bearer real-header-token')
  assert.equal(
    payload.config.headers['X-Custom-Authorization'],
    'Bearer neutral-header-secret',
  )
  assert.equal(payload.config.endpoint, '/orders?access_token=embedded-secret&limit=20')
  assert.equal(payload.config.base_url, 'https://demo-user:demo-password@example.test')
  assert.deepEqual(payload.config.unknown_option, { keep: true })
  assert.deepEqual(payload.config.field_mappings, [
    {
      source_field: 'legacy',
      target_field: 'legacy',
      field_type: 'simple',
      on_error: 'fail',
    },
  ])

  for (const field of [
    'profile_id',
    'inbound_profile_id',
    'outbound_profile_id',
    'profile_candidates',
    'review_state',
    'sanitized_config',
  ]) {
    assert.equal(field in payload, false)
    assert.equal(field in payload.config, false)
  }
})

test('empty or absent legacy field_mappings remain valid payload inputs', () => {
  const withoutMappings = buildBackendIntegrationPayload({
    name: 'Sin legacy',
    source_entity: 'sales_order',
    connector_type: 'api',
    source_system: 'tiendanube',
    config: { endpoint: '/orders' },
  })
  const withEmptyMappings = buildBackendIntegrationPayload({
    name: 'Legacy vacío',
    source_entity: 'sales_order',
    connector_type: 'api',
    source_system: 'tiendanube',
    config: { endpoint: '/orders', field_mappings: [] },
    field_mappings: [],
  })

  assert.equal('field_mappings' in withoutMappings.config, false)
  assert.deepEqual(withEmptyMappings.config.field_mappings, [])
})
