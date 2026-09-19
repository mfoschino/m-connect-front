import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

let vite
let CanonicalFlowReadOnly

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  const module = await vite.ssrLoadModule(
    '/src/components/integrations/CanonicalFlowReadOnly.jsx',
  )
  CanonicalFlowReadOnly = module.default
})

after(async () => {
  await vite?.close()
})

const inboundProfile = (overrides = {}) => ({
  id: 'inbound-profile-id',
  name: 'Nombre legacy que no debe mostrarse',
  source_system: 'tiendanube',
  entity: 'sales_order',
  version: '1.0.0',
  is_active: true,
  config: [
    {
      source_field: 'id',
      target_field: 'external_id',
      field_type: 'expression',
      expression: 'str(id)',
    },
    {
      source_field: 'status',
      target_field: 'status',
      field_type: 'lookup',
      lookup_table_code: 'TiendaNubeStatusMap',
    },
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
  entity: 'sales_order',
  version: '1.0.0',
  is_active: true,
  config: [
    { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
    { source_field: 'discount_percent', target_field: 'Descuento1', field_type: 'simple' },
    {
      source_field: '**constant**',
      target_field: 'Cliente',
      field_type: 'constant',
      constant_value: 'CF',
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

const renderFlow = (overrides = {}) => renderToString(
  React.createElement(CanonicalFlowReadOnly, {
    inboundProfiles: [inboundProfile()],
    outboundProfiles: [outboundProfile()],
    sourceLabel: 'Tienda Nube',
    canonicalEntityLabel: 'Pedido de venta canónico M-Connect',
    destinationLabel: 'Finnegans Pedido de venta',
    ...overrides,
  }),
)

test('muestra loading coherente mientras se consultan profiles', () => {
  const html = renderFlow({ loading: true, inboundProfiles: [], outboundProfiles: [] })

  assert.match(html, /Consultando perfiles de mapeo reales/)
  assert.doesNotMatch(html, /Campos canónicos observados<\/h5>/)
})

test('cero inbound conserva consumos outbound como observados sin producción', () => {
  const html = renderFlow({ inboundProfiles: [] })

  assert.match(html, /No existe un MappingProfile inbound compatible observado/)
  assert.match(html, /discount_percent/)
  assert.match(html, /Sin producción inbound observada/)
})

test('cero outbound conserva producciones inbound sin consumo observado', () => {
  const html = renderFlow({ outboundProfiles: [] })

  assert.match(html, /No existe un MappingProfile outbound compatible observado/)
  assert.match(html, /status/)
  assert.match(html, /Sin consumo outbound observado/)
})

test('cero inbound y cero outbound muestra estado informativo sin inventar catálogo ni selección', () => {
  const html = renderFlow({ inboundProfiles: [], outboundProfiles: [] })

  assert.match(html, /No existe un MappingProfile inbound compatible observado/)
  assert.match(html, /No existe un MappingProfile outbound compatible observado/)
  assert.match(html, /0(?:<!-- -->)? campos raíz observados/)
  assert.match(html, /No hay campos canónicos observados en los perfiles compatibles actuales/)
  assert.doesNotMatch(html, /Campo canónico observado/)
  assert.doesNotMatch(html, /external_id|discount_percent|IdentificacionExterna/)
  assert.doesNotMatch(html, /inbound-profile-id|outbound-profile-id/)
})

test('exactamente un inbound y un outbound muestra trazabilidad y constantes separadas', () => {
  const html = renderFlow()

  assert.match(html, /Trazabilidad canónica configurada/)
  assert.match(html, /tiendanube · sales_order · 1\.0\.0/)
  assert.match(html, /finnegans · sales_order · 1\.0\.0/)
  assert.doesNotMatch(html, /Nombre legacy que no debe mostrarse/)
  assert.match(html, /external_id/)
  assert.match(html, /IdentificacionExterna/)
  assert.match(html, /Expresión: str\(id\)/)
  assert.match(html, /Lookup: TiendaNubeStatusMap/)
  assert.match(html, /lines\[\]\.sku/)
  assert.match(html, /Items\[\]\.ProductoCodigo/)
  assert.match(html, /Valores agregados por el mapping de salida/)
  assert.match(html, /Cliente<!-- --> = <!-- -->(?:&quot;|")CF(?:&quot;|")/)
})

test('muestra una expression outbound sin source en la sección no asociada', () => {
  const html = renderFlow({
    inboundProfiles: [],
    outboundProfiles: [outboundProfile({
      config: [
        {
          target_field: 'TotalCalculado',
          field_type: 'expression',
          expression: 'foo + bar',
        },
      ],
    })],
  })

  assert.match(html, /Reglas de salida sin consumo canónico identificable/)
  assert.match(html, /TotalCalculado/)
  assert.match(html, /Expresión: foo \+ bar/)
  assert.match(html, /Sin campo canónico source identificado/)
  assert.doesNotMatch(html, /Campo canónico observado/)
})

test('renderiza por separado branches table y nested_object homónimos', () => {
  const html = renderFlow({
    inboundProfiles: [inboundProfile({
      config: [
        {
          source_field: 'a',
          target_field: 'lines',
          field_type: 'table',
          sub_mappings: [
            { source_field: 'a_sku', target_field: 'sku', field_type: 'simple' },
          ],
        },
        {
          source_field: 'b',
          target_field: 'lines',
          field_type: 'nested_object',
          sub_mappings: [
            { source_field: 'b_sku', target_field: 'sku', field_type: 'simple' },
          ],
        },
      ],
    })],
    outboundProfiles: [],
  })

  assert.match(html, /Ramas estructurales observadas dentro de <!-- -->lines/)
  assert.match(html, /Inbound: a → lines/)
  assert.match(html, /Inbound: b → lines/)
  assert.match(html, /lines\[\]\.sku/)
  assert.match(html, /lines\.sku/)
  assert.match(html, /Tabla/)
  assert.match(html, /Objeto anidado/)
})

test('múltiples inbound no se fusionan ni generan tabla combinada', () => {
  const html = renderFlow({
    inboundProfiles: [
      inboundProfile({ id: 'inbound-v1', version: '1.0.0' }),
      inboundProfile({ id: 'inbound-v2', version: '2.0.0' }),
    ],
  })

  assert.match(html, /Se detectaron múltiples perfiles compatibles/)
  assert.match(html, /frontend no puede determinar cuál se utilizará/)
  assert.match(html, /inbound-v1/)
  assert.match(html, /inbound-v2/)
  assert.doesNotMatch(html, /Campos canónicos observados<\/h5>/)
})

test('múltiples outbound no se eligen ni fusionan', () => {
  const html = renderFlow({
    outboundProfiles: [
      outboundProfile({ id: 'outbound-v1', version: '1.0.0' }),
      outboundProfile({ id: 'outbound-v2', version: '2.0.0' }),
    ],
  })

  assert.match(html, /Se detectaron múltiples perfiles compatibles/)
  assert.match(html, /outbound-v1/)
  assert.match(html, /outbound-v2/)
  assert.doesNotMatch(html, /Campos canónicos observados<\/h5>/)
})

test('explica visiblemente que no representa schema ni payload de ejecución', () => {
  const html = renderFlow()

  assert.match(html, /No es un payload de ejecución ni el schema oficial de la entidad/)
})

test('el paso 4 queda cableado al componente real y deja de leer ENTITY_FIELD_SPECS', async () => {
  const source = await readFile(
    new URL('../src/components/integrations/IntegrationForm.jsx', import.meta.url),
    'utf8',
  )
  const stepFourStart = source.indexOf('{currentStep === 4 ? (')
  const stepFiveStart = source.indexOf('{currentStep === 5 ? (')
  const stepFour = source.slice(stepFourStart, stepFiveStart)

  assert.ok(stepFourStart >= 0 && stepFiveStart > stepFourStart)
  assert.match(stepFour, /<CanonicalFlowReadOnly/)
  assert.match(stepFour, /inboundProfiles=\{inboundProfiles\}/)
  assert.match(stepFour, /outboundProfiles=\{outboundProfiles\}/)
  assert.doesNotMatch(source, /getEntityFieldSpec|canonicalFields/)
  assert.doesNotMatch(stepFour, /OrderId|Email|Date|TotalAmount|Campos canónicos disponibles/)
})
