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

const withoutReactTextMarkers = (html) => html.replaceAll('<!-- -->', '')
const firstLevel = (html) => html.slice(0, html.indexOf('<details'))

test('muestra loading coherente mientras se consultan profiles', () => {
  const html = renderFlow({ loading: true, inboundProfiles: [], outboundProfiles: [] })

  assert.match(html, /Consultando perfiles de mapeo reales/)
  assert.doesNotMatch(html, /Campos canónicos observados<\/h5>/)
})

test('cero inbound conserva consumos outbound como observados sin producción', () => {
  const html = renderFlow({ inboundProfiles: [] })

  assert.match(html, /No existe un MappingProfile inbound compatible observado/)
  assert.match(html, /no se puede reconstruir la producción canónica observada de entrada/)
  assert.match(html, /discount_percent/)
  assert.match(html, /Sin producción inbound observada/)
  assert.doesNotMatch(html, /Resumen de trazabilidad canónica|Ver trazabilidad completa/)
})

test('cero outbound conserva producciones inbound sin consumo observado', () => {
  const html = renderFlow({ outboundProfiles: [] })

  assert.match(html, /No existe un MappingProfile outbound compatible observado/)
  assert.match(html, /no se puede reconstruir el consumo canónico observado de salida/)
  assert.match(html, /status/)
  assert.match(html, /Sin consumo outbound observado/)
  assert.doesNotMatch(html, /Resumen de trazabilidad canónica|Ver trazabilidad completa/)
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
  assert.doesNotMatch(html, /Resumen de trazabilidad canónica|Ver trazabilidad completa/)
})

test('exactamente un inbound y un outbound muestra resumen de campos raíz y detalle colapsado', () => {
  const html = renderFlow()
  const summary = withoutReactTextMarkers(firstLevel(html))

  assert.match(html, /<h4[^>]*>Trazabilidad canónica<\/h4>/)
  assert.match(summary, /Tienda Nube.*Pedido de venta canónico M-Connect.*Finnegans Pedido de venta/)
  assert.match(summary, /Campos canónicos principales observados en estos perfiles/)
  assert.match(summary, /2<\/span> campos relacionados entre entrada y salida/)
  assert.match(summary, /1 campo sólo producido por entrada/)
  assert.match(summary, /1 campo sólo consumido por salida/)
  assert.match(summary, /1<\/span> valor agregado por la transformación de salida/)
  assert.doesNotMatch(summary, /inválid|error|correctos|válidos|compatible al 100%/i)
  assert.match(html, /<details(?![^>]*\bopen\b)[^>]*><summary[^>]*>Ver trazabilidad completa<\/summary>/)
  assert.equal(html.match(/<details\b/g)?.length, 1)
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
  assert.doesNotMatch(summary, /target_field|source_field|sub_mappings|Campo canónico observado/)
  assert.doesNotMatch(html, /<input|<button|<select|type="radio"/)
})

test('las etiquetas del flujo vienen de props y no del ejemplo', () => {
  const summary = firstLevel(renderFlow({
    sourceLabel: 'Origen propio',
    canonicalEntityLabel: 'Entidad canónica propia',
    destinationLabel: 'Destino propio',
  }))

  assert.match(summary, /Origen propio.*Entidad canónica propia.*Destino propio/)
  assert.doesNotMatch(summary, /Tienda Nube|Finnegans Pedido de venta/)
})

test('un único campo relacionado no inventa excepciones ni suma reglas hijas', () => {
  const summary = withoutReactTextMarkers(firstLevel(renderFlow({
    inboundProfiles: [inboundProfile({ config: [
      { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
    ] })],
    outboundProfiles: [outboundProfile({ config: [
      { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
    ] })],
  })))

  assert.match(summary, /1<\/span> campo relacionado entre entrada y salida/)
  assert.match(summary, /0<\/span> valores agregados por la transformación de salida/)
  assert.doesNotMatch(summary, /También se observa|sólo producido|sólo consumido/)
})

test('resume reglas outbound sin source sólo con los dos perfiles inequívocos', () => {
  const html = renderFlow({
    outboundProfiles: [outboundProfile({
      config: [
        { target_field: 'TotalCalculado', field_type: 'expression', expression: 'foo + bar' },
      ],
    })],
  })
  const summary = withoutReactTextMarkers(firstLevel(html))

  assert.match(summary, /1 regla de salida sin consumo canónico identificable/)
  assert.match(summary, /0<\/span> campos relacionados entre entrada y salida/)
  assert.match(html, /Expresión: foo \+ bar/)
  assert.match(html, /Sin campo canónico source identificado/)
  assert.doesNotMatch(summary, /foo|bar|TotalCalculado/)
})

test('el resumen no suma hijos ni fusiona ramas estructurales homónimas', () => {
  const html = renderFlow({
    inboundProfiles: [inboundProfile({ config: [
      { source_field: 'a', target_field: 'lines', field_type: 'table', sub_mappings: [
        { source_field: 'a_sku', target_field: 'sku', field_type: 'simple' },
      ] },
      { source_field: 'b', target_field: 'lines', field_type: 'nested_object', sub_mappings: [
        { source_field: 'b_sku', target_field: 'sku', field_type: 'simple' },
      ] },
    ] })],
    outboundProfiles: [outboundProfile({ config: [
      { source_field: 'lines', target_field: 'Items', field_type: 'table', sub_mappings: [
        { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
      ] },
    ] })],
  })
  const summary = withoutReactTextMarkers(firstLevel(html))

  assert.match(summary, /1<\/span> campo relacionado entre entrada y salida/)
  assert.doesNotMatch(summary, /3<\/span> campos relacionados/)
  assert.match(html, /Inbound: a → lines/)
  assert.match(html, /Inbound: b → lines/)
  assert.match(html, /lines\[\]\.sku/)
  assert.match(html, /lines\.sku/)
  assert.match(html, /Items\[\]\.ProductoCodigo/)
  assert.equal(html.match(/Rama inbound<\/p>/g)?.length, 2)
  assert.equal(html.match(/Rama outbound<\/p>/g)?.length, 1)
})

for (const [label, value, rendered] of [
  ['false', false, 'false'],
  ['cero', 0, '0'],
  ['null', null, 'null'],
  ['string vacío', '', '&quot;&quot;'],
]) {
  test(`conserva constante outbound ${label} en el resumen y el detalle`, () => {
    const html = withoutReactTextMarkers(renderFlow({
      outboundProfiles: [outboundProfile({ config: [
        { source_field: '**constant**', target_field: 'ValorFijo', field_type: 'constant', constant_value: value },
      ] })],
    }))

    assert.match(firstLevel(html), /1<\/span> valor agregado por la transformación de salida/)
    assert.ok(html.includes(`ValorFijo = ${rendered}`))
  })
}

test('el detalle conserva lookup, expression y formatos datetime sin interpretarlos', () => {
  const html = renderFlow({
    inboundProfiles: [inboundProfile({ config: [
      { source_field: 'status', target_field: 'status', field_type: 'lookup', lookup_table_code: 'EstadoMap' },
      { target_field: 'total', field_type: 'expression', expression: 'float(price) * quantity' },
      { source_field: 'created_at', target_field: 'ordered_at', field_type: 'datetime', source_format: '%Y-%m-%d', target_format: 'iso' },
    ] })],
  })

  assert.match(html, /Lookup: EstadoMap/)
  assert.match(html, /Expresión: float\(price\) \* quantity/)
  assert.match(html, /Formato de origen: %Y-%m-%d/)
  assert.match(html, /Formato de destino: iso/)
  assert.doesNotMatch(firstLevel(html), /EstadoMap|float\(price\)|%Y-%m-%d/)
})

test('constantes y reglas sin source anidadas conservan target y path dentro del detalle', () => {
  const html = renderFlow({
    outboundProfiles: [outboundProfile({ config: [
      { source_field: 'lines', target_field: 'Items', field_type: 'table', sub_mappings: [
        { source_field: '**constant**', target_field: 'Activo', field_type: 'constant', constant_value: false },
        { target_field: 'TotalCalculado', field_type: 'expression', expression: 'price * quantity' },
      ] },
    ] })],
  })
  const summary = withoutReactTextMarkers(firstLevel(html))

  assert.match(summary, /1<\/span> valor agregado por la transformación de salida/)
  assert.match(summary, /1 regla de salida sin consumo canónico identificable/)
  assert.match(html, /Items\[\]\.Activo<!-- --> = <!-- -->false/)
  assert.match(html, /Items\[\]\.TotalCalculado/)
  assert.match(html, /Expresión: price \* quantity/)
})

test('el resumen conserva la igualdad técnica exacta sin trim', () => {
  const summary = withoutReactTextMarkers(firstLevel(renderFlow({
    inboundProfiles: [inboundProfile({ config: [
      { source_field: 'raw', target_field: ' currency ', field_type: 'simple' },
    ] })],
    outboundProfiles: [outboundProfile({ config: [
      { source_field: 'currency', target_field: 'Moneda', field_type: 'simple' },
    ] })],
  })))

  assert.match(summary, /0<\/span> campos relacionados entre entrada y salida/)
  assert.match(summary, /1 campo sólo producido por entrada/)
  assert.match(summary, /1 campo sólo consumido por salida/)
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
  assert.doesNotMatch(html, /Resumen de trazabilidad canónica|Ver trazabilidad completa/)
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
  assert.doesNotMatch(html, /Resumen de trazabilidad canónica|Ver trazabilidad completa/)
})

test('múltiples candidatos en ambos lados siguen inspeccionables sin métricas ni selector', () => {
  const html = renderFlow({
    inboundProfiles: [inboundProfile({ id: 'in-a' }), inboundProfile({ id: 'in-b' })],
    outboundProfiles: [outboundProfile({ id: 'out-a' }), outboundProfile({ id: 'out-b' })],
  })

  for (const id of ['in-a', 'in-b', 'out-a', 'out-b']) assert.match(html, new RegExp(id))
  assert.match(html, /no se genera una trazabilidad combinada/)
  assert.doesNotMatch(html, /Resumen de trazabilidad canónica|Ver trazabilidad completa/)
  assert.doesNotMatch(html, /<select|type="radio"/)
})

test('explica visiblemente que no representa schema ni payload de ejecución', () => {
  const html = renderFlow()

  assert.match(html, /No es un payload de ejecución ni el schema oficial de la entidad/)
  assert.match(html, /validación[\s\S]*semántica completa/)
})

test('el paso 6 queda cableado al componente real y deja de leer ENTITY_FIELD_SPECS', async () => {
  const source = await readFile(
    new URL('../src/components/integrations/IntegrationForm.jsx', import.meta.url),
    'utf8',
  )
  const stepSixStart = source.indexOf('{currentStep === 6 ? (')
  const stepSevenStart = source.indexOf('{currentStep === 7 ? (')
  const stepSix = source.slice(stepSixStart, stepSevenStart)

  assert.ok(stepSixStart >= 0 && stepSevenStart > stepSixStart)
  assert.match(stepSix, /<CanonicalFlowReadOnly/)
  assert.match(stepSix, /inboundProfiles=\{inboundProfiles\}/)
  assert.match(stepSix, /outboundProfiles=\{outboundProfiles\}/)
  assert.doesNotMatch(source, /getEntityFieldSpec|canonicalFields/)
  assert.doesNotMatch(stepSix, /OrderId|Email|Date|TotalAmount|Campos canónicos disponibles/)
})
