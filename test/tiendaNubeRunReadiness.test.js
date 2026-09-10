import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getFinnegansDocument,
  getTiendaNubeRunReadiness,
  isTiendaNubeSalesOrderIntegration,
  redactSensitiveConfig,
} from '../src/services/adapters/tiendaNubeRunReadiness.js'

const integration = {
  id: 'integration-id',
  connector_type: 'api',
  source_entity: 'sales_order',
  is_active: true,
  config: {
    source_system: 'tiendanube',
    base_url: 'https://api.tiendanube.com',
    endpoint: '/2025-03/{{store_id}}/orders?payment_status=paid',
    auth_type: 'api_key',
    api_key_header: 'Authentication',
    api_key: '{{tn_api_key}}',
    headers: { Accept: 'application/json' },
    pagination: { type: 'page_number' },
    finnegans_document: 'pedido_venta',
  },
}

const lookupTables = [{ codigo: 'TiendaNubeStatusMap', name: 'Estados de Tienda Nube' }]
const inboundProfile = {
  source_system: 'tiendanube',
  entity: 'sales_order',
  is_active: true,
  config: [
    {
      source_field: 'status',
      target_field: 'status',
      field_type: 'lookup',
      lookup_table_code: 'TiendaNubeStatusMap',
    },
  ],
}
const pedidoVentaProfile = {
  source_system: 'finnegans',
  entity: 'sales_order',
  is_active: true,
  config: [],
}
const puntoVentaProfile = {
  source_system: 'finnegans_punto_venta',
  entity: 'sales_order',
  is_active: true,
  config: [],
}

const getReadiness = (overrides = {}) => getTiendaNubeRunReadiness({
  integration,
  lookupTables,
  profiles: [inboundProfile, pedidoVentaProfile],
  credentialsStatus: { has_credentials: true },
  ...overrides,
})

const withoutConfigField = (field) => {
  const config = { ...integration.config }
  delete config[field]
  return { ...integration, config }
}

test('detects a Tienda Nube API sales_order integration', () => {
  assert.equal(isTiendaNubeSalesOrderIntegration(integration), true)
})

for (const [name, value] of [
  ['null', null],
  ['undefined', undefined],
  ['a string', 'tiendanube'],
  ['a number', 42],
  ['an array', []],
  ['an empty object', {}],
  ['an object with null config', { config: null }],
  ['an object with non-object config', { config: 'tiendanube' }],
]) {
  test(`defensively rejects ${name}`, () => {
    assert.equal(isTiendaNubeSalesOrderIntegration(value), false)
  })
}

test('getFinnegansDocument tolerates incomplete values', () => {
  assert.equal(getFinnegansDocument(null), null)
  assert.equal(getFinnegansDocument(undefined), null)
  assert.equal(getFinnegansDocument({ config: null }), null)
})

test('readiness with null integration does not throw and blocks run', () => {
  const readiness = getReadiness({ integration: null })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'integration'))
})

test('readiness with null profiles does not throw and blocks run', () => {
  const readiness = getReadiness({ profiles: null })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'inbound_profile'))
  assert.ok(readiness.missingChecks.some((check) => check.id === 'outbound_profile'))
})

test('readiness with null lookupTables does not throw and blocks a referenced lookup', () => {
  const readiness = getReadiness({ lookupTables: null })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'lookup'))
})

test('readiness with null credentialsStatus does not throw and blocks run', () => {
  const readiness = getReadiness({ credentialsStatus: null })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'credentials'))
})

test('readiness tolerates a null options object', () => {
  const readiness = getTiendaNubeRunReadiness(null)

  assert.equal(readiness.canRun, false)
})

for (const [name, candidate] of [
  ['a non-Tienda Nube integration', {
    ...integration,
    config: { ...integration.config, source_system: 'shopify' },
  }],
  ['a non-api integration', { ...integration, connector_type: 'db' }],
  ['a non-sales_order integration', { ...integration, source_entity: 'customer' }],
  ['an integration without config', { ...integration, config: undefined }],
]) {
  test(`does not apply to ${name}`, () => {
    assert.equal(isTiendaNubeSalesOrderIntegration(candidate), false)
  })
}

test('reports a fully ready Pedido de Venta integration', () => {
  const readiness = getReadiness()

  assert.equal(readiness.document, 'pedido_venta')
  assert.equal(readiness.outboundSourceSystem, 'finnegans')
  assert.equal(readiness.canRun, true)
  assert.equal(readiness.fullyReady, true)
  assert.deepEqual(readiness.missingChecks, [])
})

test('reports a fully ready Punto de Venta integration', () => {
  const readiness = getReadiness({
    integration: {
      ...integration,
      config: { ...integration.config, finnegans_document: 'punto_venta' },
    },
    profiles: [inboundProfile, puntoVentaProfile],
  })

  assert.equal(readiness.outboundSourceSystem, 'finnegans_punto_venta')
  assert.equal(readiness.canRun, true)
  assert.equal(readiness.fullyReady, true)
})

test('an inactive integration blocks run', () => {
  const readiness = getReadiness({ integration: { ...integration, is_active: false } })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'integration'))
})

test('missing config does not throw and blocks run', () => {
  const readiness = getReadiness({ integration: { ...integration, config: undefined } })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'integration'))
  assert.ok(readiness.missingChecks.some((check) => check.id === 'base_url'))
})

for (const [name, config] of [['null', null], ['non-object', 'invalid']]) {
  test(`${name} config does not throw and blocks run`, () => {
    const readiness = getReadiness({ integration: { ...integration, config } })

    assert.equal(readiness.canRun, false)
    assert.ok(readiness.missingChecks.some((check) => check.id === 'integration'))
    assert.ok(readiness.missingChecks.some((check) => check.id === 'base_url'))
  })
}

for (const field of ['base_url', 'endpoint', 'auth_type', 'api_key_header', 'api_key']) {
  test(`missing ${field} blocks run`, () => {
    const readiness = getReadiness({ integration: withoutConfigField(field) })

    assert.equal(readiness.canRun, false)
  })
}

test('headers must be an object', () => {
  const readiness = getReadiness({
    integration: {
      ...integration,
      config: { ...integration.config, headers: 'invalid' },
    },
  })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'headers'))
})

test('pagination must be an object', () => {
  const readiness = getReadiness({
    integration: {
      ...integration,
      config: { ...integration.config, pagination: 'invalid' },
    },
  })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'pagination'))
})

for (const [name, document] of [['missing', undefined], ['invalid', 'invoice']]) {
  test(`${name} finnegans_document blocks run`, () => {
    const targetIntegration = document === undefined
      ? withoutConfigField('finnegans_document')
      : {
          ...integration,
          config: { ...integration.config, finnegans_document: document },
        }
    const readiness = getReadiness({ integration: targetIntegration })

    assert.equal(readiness.canRun, false)
    assert.ok(readiness.missingChecks.some((check) => check.id === 'finnegans_document'))
  })
}

test('missing inbound profile blocks run', () => {
  const readiness = getReadiness({ profiles: [pedidoVentaProfile] })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'inbound_profile'))
})

test('an inactive inbound profile blocks run', () => {
  const readiness = getReadiness({
    profiles: [{ ...inboundProfile, is_active: false }, pedidoVentaProfile],
  })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'inbound_profile'))
})

test('missing Pedido de Venta outbound profile blocks run', () => {
  const readiness = getReadiness({ profiles: [inboundProfile] })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'outbound_profile'))
})

test('missing Punto de Venta outbound profile blocks run', () => {
  const readiness = getReadiness({
    integration: {
      ...integration,
      config: { ...integration.config, finnegans_document: 'punto_venta' },
    },
    profiles: [inboundProfile, pedidoVentaProfile],
  })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'outbound_profile'))
})

test('missing lookup table referenced by inbound profile blocks run', () => {
  const readiness = getReadiness({ lookupTables: [] })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'lookup'))
})

test('lookup readiness resolves the required table by codigo, not by name', () => {
  const readiness = getReadiness({
    lookupTables: [
      { codigo: 'OtherMap', name: 'TiendaNubeStatusMap' },
    ],
  })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'lookup'))
})

test('an unreferenced lookup table does not block run', () => {
  const readiness = getReadiness({
    lookupTables: [],
    profiles: [{ ...inboundProfile, config: [] }, pedidoVentaProfile],
  })

  assert.equal(readiness.canRun, true)
  assert.ok(!readiness.missingChecks.some((check) => check.id === 'lookup'))
})

test('a legacy lookup_table_name reference remains readable', () => {
  const legacyInboundProfile = {
    ...inboundProfile,
    config: [
      {
        source_field: 'status',
        target_field: 'status',
        field_type: 'lookup',
        lookup_table_name: 'TiendaNubeStatusMap',
      },
    ],
  }
  const readiness = getReadiness({ profiles: [legacyInboundProfile, pedidoVentaProfile] })

  assert.equal(readiness.canRun, true)
  assert.ok(!readiness.missingChecks.some((check) => check.id === 'lookup'))
})

test('missing Finnegans credentials block run', () => {
  const readiness = getReadiness({ credentialsStatus: { has_credentials: false } })

  assert.equal(readiness.canRun, false)
  assert.ok(readiness.missingChecks.some((check) => check.id === 'credentials'))
})

test('redacts connector secrets without hiding non-secret configuration', () => {
  assert.deepEqual(redactSensitiveConfig({
    api_key: '{{tn_api_key}}',
    bearer_token: '{{bearer_token}}',
    client_secret: '{{client_secret}}',
    secret: '{{webhook_secret}}',
    api_key_header: 'Authentication',
    headers: {
      Authentication: 'bearer placeholder',
      Authorization: 'Bearer placeholder',
      Accept: 'application/json',
    },
  }), {
    api_key: '[configurado]',
    bearer_token: '[configurado]',
    client_secret: '[configurado]',
    secret: '[configurado]',
    api_key_header: 'Authentication',
    headers: {
      Authentication: '[configurado]',
      Authorization: '[configurado]',
      Accept: 'application/json',
    },
  })
})
