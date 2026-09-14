import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let IntegrationReview

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const module = await vite.ssrLoadModule(
    '/src/components/integrations/IntegrationReview.jsx',
  )
  IntegrationReview = module.default
})

after(async () => {
  await vite?.close()
})

const inboundProfile = (overrides = {}) => ({
  id: 'inbound-profile-id',
  source_system: 'tiendanube',
  source_entity: 'sales_order',
  version: '1.0.0',
  active: true,
  config: [
    { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
    {
      source_field: 'status',
      target_field: 'status',
      field_type: 'lookup',
      lookup_table_code: 'TiendaNubeStatusMap',
    },
    { source_field: 'total', target_field: 'total', field_type: 'simple' },
    { source_field: 'created_at', target_field: 'ordered_at', field_type: 'datetime' },
    {
      source_field: 'products',
      target_field: 'lines',
      field_type: 'table',
      sub_mappings: [
        { source_field: 'sku', target_field: 'sku', field_type: 'simple' },
      ],
    },
  ],
  ...overrides,
})

const outboundProfile = (overrides = {}) => ({
  id: 'outbound-profile-id',
  source_system: 'finnegans',
  source_entity: 'sales_order',
  version: '1.0.0',
  active: true,
  config: [
    { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
    {
      source_field: '**constant**',
      target_field: 'Cliente',
      field_type: 'constant',
      constant_value: 'CF',
    },
    {
      source_field: 'currency',
      target_field: 'MonedaCodigo',
      field_type: 'lookup',
      lookup_table_code: 'FinnegansMonedaMap',
    },
    {
      source_field: 'lines',
      target_field: 'Items',
      field_type: 'table',
      sub_mappings: [
        { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
      ],
    },
  ],
  ...overrides,
})

const baseProps = (overrides = {}) => ({
  name: 'Tienda Nube → Finnegans',
  isActive: true,
  sourceSystemId: 'tiendanube',
  sourceSystemLabel: 'Tienda Nube',
  connectorType: 'api',
  connectorTypeLabel: 'API',
  entity: 'sales_order',
  canonicalEntityLabel: 'Pedido de venta canónico M-Connect',
  finnegansDocument: 'pedido_venta',
  finnegansDocumentLabel: 'Pedido de Venta',
  schedule: null,
  config: {
    source_system: 'tiendanube',
    store_id: '123',
    endpoint: '/orders?access_token=embedded-secret&limit=20',
    base_url: 'https://demo-user:demo-password@example.test',
    auth_type: 'api_key',
    api_key_header: 'Authentication',
    access_token: 'secret-token',
    api_key: 'secret-key',
    basic_password: 'basic-secret',
    headers: {
      Authentication: 'bearer another-secret',
      'Content-Type': 'application/json',
      'X-Shop-Access-Token': 'custom-header-secret',
      'X-Custom-Authorization': 'Bearer neutral-header-secret',
    },
    field_mappings: [
      {
        source_field: 'legacy_source_should_not_render',
        target_field: 'legacy_target_should_not_render',
        field_type: 'simple',
      },
    ],
  },
  inboundProfiles: [inboundProfile()],
  outboundProfiles: [outboundProfile()],
  profilesLoading: false,
  outboundSourceSystem: 'finnegans',
  ...overrides,
})

const renderReview = (overrides = {}) => renderToString(
  React.createElement(IntegrationReview, baseProps(overrides)),
)

test('Review shows IntegrationConfig and both real configured transformations', () => {
  const html = renderReview()

  assert.match(html, /Resumen de la configuración/)
  assert.match(html, /Tienda Nube → Finnegans/)
  assert.match(html, /Sistema de origen/)
  assert.match(html, /Tienda Nube/)
  assert.match(html, /Tipo de conector/)
  assert.match(html, /API/)
  assert.match(html, /sales_order/)
  assert.match(html, /Documento Finnegans/)
  assert.match(html, /Pedido de Venta/)
  assert.match(html, /Activa/)
  assert.match(html, /Manual/)

  assert.match(html, /Entrada → Canónico/)
  assert.match(html, /Canónico → Destino/)
  assert.match(html, /inbound-profile-id/)
  assert.match(html, /outbound-profile-id/)
  assert.equal(
    html.match(/Configuración JSON del MappingProfile/g)?.length,
    2,
  )
  assert.match(html, /source_field/)
  assert.match(html, /external_id/)
  assert.match(html, /lookup_table_code/)
  assert.match(html, /TiendaNubeStatusMap/)
  assert.match(html, /IdentificacionExterna/)
  assert.match(html, /constant_value/)
  assert.match(html, /CF/)
  assert.match(html, /FinnegansMonedaMap/)
  assert.match(html, /Items/)
  assert.match(html, /sub_mappings/)
  assert.match(html, /ProductoCodigo/)
  assert.doesNotMatch(html, /Mapeos anidados/)
  assert.doesNotMatch(html, /Lookup:/)
  assert.doesNotMatch(html, /Constante /)
  assert.doesNotMatch(html, /Perfil de mapeo/)
  assert.doesNotMatch(html, /Ver configuración JSON del perfil/)
  assert.doesNotMatch(html, /<details/)
  assert.match(html, /Esta vista representa las transformaciones configuradas\./)
  assert.match(html, /Los datos transformados reales se generan durante la ejecución\./)

  assert.doesNotMatch(html, /legacy_source_should_not_render/)
  assert.doesNotMatch(html, /legacy_target_should_not_render/)
  assert.doesNotMatch(html, /field_mappings/)
  assert.doesNotMatch(html, /reglas ·/)
  assert.doesNotMatch(html, /Datos finales enviados/)
})

test('Review redacts secrets recursively while retaining useful source configuration', () => {
  const html = renderReview()

  assert.match(html, /store_id/)
  assert.match(html, /123/)
  assert.match(html, /endpoint/)
  assert.match(html, /\/orders\?access_token=\[configurado\](?:&amp;|&amp;amp;)limit=20/)
  assert.match(html, /https:\/\/\[configurado\]@example\.test/)
  assert.match(html, /Content-Type/)
  assert.match(html, /application\/json/)
  assert.match(html, /\[configurado\]/)
  assert.match(html, /Valores sensibles protegidos/)
  assert.doesNotMatch(html, /secret-token/)
  assert.doesNotMatch(html, /secret-key/)
  assert.doesNotMatch(html, /basic-secret/)
  assert.doesNotMatch(html, /another-secret/)
  assert.doesNotMatch(html, /custom-header-secret/)
  assert.doesNotMatch(html, /embedded-secret/)
  assert.doesNotMatch(html, /demo-user/)
  assert.doesNotMatch(html, /demo-password/)
  assert.doesNotMatch(html, /neutral-header-secret/)
})

test('Review renders inbound, outbound and combined missing-profile states', () => {
  const withoutInbound = renderReview({ inboundProfiles: [] })
  const withoutOutbound = renderReview({ outboundProfiles: [] })
  const withoutBoth = renderReview({ inboundProfiles: [], outboundProfiles: [] })

  assert.match(withoutInbound, /No existe un MappingProfile inbound activo compatible\./)
  assert.doesNotMatch(withoutInbound, /No existe un MappingProfile outbound activo compatible\./)
  assert.match(withoutInbound, /Requisito pendiente/)
  assert.match(withoutInbound, /Sistema: tiendanube/)
  assert.match(withoutInbound, /Entidad: sales_order/)

  assert.match(withoutOutbound, /No existe un MappingProfile outbound activo compatible\./)
  assert.doesNotMatch(withoutOutbound, /No existe un MappingProfile inbound activo compatible\./)
  assert.match(withoutOutbound, /Sistema: finnegans/)
  assert.match(withoutOutbound, /Documento: Pedido de Venta/)

  assert.equal(
    withoutBoth.match(/No existe un MappingProfile (?:inbound|outbound) activo compatible\./g)?.length,
    2,
  )
  assert.doesNotMatch(withoutBoth, /<select|type="radio"|role="radio"/)
})

test('Review shows every ambiguous candidate without choosing a version', () => {
  const html = renderReview({
    inboundProfiles: [
      inboundProfile({
        id: 'inbound-v1',
        version: '1.0.0',
        config: [
          { source_field: 'id', target_field: 'inbound_v1_target', field_type: 'simple' },
        ],
      }),
      inboundProfile({
        id: 'inbound-v2',
        version: '2.0.0',
        config: [
          { source_field: 'id', target_field: 'inbound_v2_target', field_type: 'simple' },
        ],
      }),
    ],
    outboundProfiles: [
      outboundProfile({
        id: 'outbound-v1',
        version: '1.0.0',
        config: [
          { source_field: 'external_id', target_field: 'outbound_v1_target', field_type: 'simple' },
        ],
      }),
      outboundProfile({
        id: 'outbound-v2',
        version: '2.0.0',
        config: [
          { source_field: 'external_id', target_field: 'outbound_v2_target', field_type: 'simple' },
        ],
      }),
    ],
  })

  assert.match(html, /Se encontraron múltiples MappingProfiles activos compatibles\./)
  assert.match(html, /Backend determinará cuál resolver durante la ejecución\./)
  assert.match(html, /inbound-v1/)
  assert.match(html, /inbound-v2/)
  assert.match(html, /outbound-v1/)
  assert.match(html, /outbound-v2/)
  assert.match(html, /inbound_v1_target/)
  assert.match(html, /inbound_v2_target/)
  assert.match(html, /outbound_v1_target/)
  assert.match(html, /outbound_v2_target/)
  assert.equal(html.match(/Configuración JSON del MappingProfile/g)?.length, 4)
  assert.ok(html.indexOf('inbound-v1') < html.indexOf('inbound-v2'))
  assert.ok(html.indexOf('outbound-v1') < html.indexOf('outbound-v2'))
  assert.doesNotMatch(html, /<select|type="radio"|role="radio"|seleccionado/i)
  assert.doesNotMatch(html, /Mapeos anidados|Lookup:|Constante /)
})

test('Review distinguishes manual/scheduled and active/inactive integrations', () => {
  const manualActive = renderReview({ schedule: null, isActive: true })
  const hourlyInactive = renderReview({ schedule: '0 * * * *', isActive: false })

  assert.match(manualActive, /Manual/)
  assert.match(manualActive, /Activa/)
  assert.match(hourlyInactive, /Cada hora/)
  assert.match(hourlyInactive, /Inactiva/)
})

test('Review remains stable with empty, absent or loading profile data', () => {
  assert.doesNotThrow(() => renderReview({ inboundProfiles: null, outboundProfiles: null }))
  assert.doesNotThrow(() => renderReview({ inboundProfiles: [], outboundProfiles: [], config: {} }))

  const loading = renderReview({
    profilesLoading: true,
    inboundProfiles: [],
    outboundProfiles: [],
  })
  assert.match(loading, /Consultando perfiles de mapeo reales/)
})

test('wizard step validation no longer inspects hidden legacy field_mappings', async () => {
  const source = await readFile(
    new URL('../src/components/integrations/IntegrationForm.jsx', import.meta.url),
    'utf8',
  )
  const validationBody = source.slice(
    source.indexOf('const validateStep ='),
    source.indexOf('const validateAllSteps ='),
  )

  assert.doesNotMatch(validationBody, /fieldMappings|field_mappings|getMappingValidationErrors/)
  assert.match(validationBody, /El nombre de la integración es obligatorio/)
  assert.match(validationBody, /Seleccioná el documento destino de Finnegans/)
})
