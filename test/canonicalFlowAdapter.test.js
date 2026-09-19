import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCanonicalFlowTrace } from '../src/services/adapters/canonicalFlowAdapter.js'

const profile = (config, overrides = {}) => ({
  source_system: 'source',
  entity: 'sales_order',
  version: '1.0.0',
  config,
  is_active: true,
  ...overrides,
})

const flattenFields = (fields) => fields.flatMap((field) => [
  field,
  ...field.branches.flatMap((branch) => flattenFields(branch.children)),
])

const findField = (trace, canonicalPath) => (
  flattenFields(trace.fields).find((field) => field.canonicalPath === canonicalPath)
)

const findFields = (trace, canonicalPath) => (
  flattenFields(trace.fields).filter((field) => field.canonicalPath === canonicalPath)
)

test('relaciona valores técnicos idénticos sin transformarlos', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'source_currency', target_field: 'currency', field_type: 'simple' },
    ]),
    outboundProfile: profile([
      { source_field: 'currency', target_field: 'MonedaCodigo', field_type: 'simple' },
    ]),
  })

  assert.equal(trace.fields.length, 1)
  assert.equal(trace.fields[0].producers.length, 1)
  assert.equal(trace.fields[0].consumers.length, 1)
})

test('no aplica trim para relacionar campos técnicos', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'source_currency', target_field: ' currency ', field_type: 'simple' },
    ]),
    outboundProfile: profile([
      { source_field: 'currency', target_field: 'MonedaCodigo', field_type: 'simple' },
    ]),
  })

  assert.deepEqual(trace.fields.map((field) => field.canonicalField), [' currency ', 'currency'])
  assert.equal(trace.fields[0].consumers.length, 0)
  assert.equal(trace.fields[1].producers.length, 0)
})

test('relaciona únicamente por igualdad exacta entre target_field inbound y source_field outbound', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'currency', target_field: 'currency', field_type: 'simple' },
    ]),
    outboundProfile: profile([
      { source_field: 'Currency', target_field: 'MonedaCodigo', field_type: 'simple' },
    ]),
  })

  assert.deepEqual(trace.fields.map((field) => field.canonicalField), ['currency', 'Currency'])
  assert.equal(trace.fields[0].consumers.length, 0)
  assert.equal(trace.fields[1].producers.length, 0)
})

test('no coerciona valores no-string para crear coincidencias', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'raw_code', target_field: 123, field_type: 'simple' },
    ]),
    outboundProfile: profile([
      { source_field: '123', target_field: 'Codigo', field_type: 'simple' },
    ]),
  })

  assert.deepEqual(trace.fields.map((field) => field.canonicalField), ['123'])
  assert.equal(trace.fields[0].producers.length, 0)
  assert.equal(trace.fields[0].consumers.length, 1)
})

test('conserva un campo producido y consumido con ambos mappings', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
    ]),
    outboundProfile: profile([
      { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
    ]),
  })
  const field = findField(trace, 'external_id')

  assert.equal(field.producers.length, 1)
  assert.equal(field.producers[0].sourceField, 'id')
  assert.equal(field.consumers.length, 1)
  assert.equal(field.consumers[0].targetPath, 'IdentificacionExterna')
})

test('conserva campos sólo producidos sin marcarlos como inválidos', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'status', target_field: 'status', field_type: 'simple' },
    ]),
  })

  assert.equal(findField(trace, 'status').producers.length, 1)
  assert.equal(findField(trace, 'status').consumers.length, 0)
})

test('conserva campos sólo consumidos sin inventar productores', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      { source_field: 'discount_percent', target_field: 'Descuento1', field_type: 'simple' },
    ]),
  })

  assert.equal(findField(trace, 'discount_percent').producers.length, 0)
  assert.equal(findField(trace, 'discount_percent').consumers.length, 1)
})

test('preserva múltiples productores del mismo campo canónico', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { source_field: 'id', target_field: 'external_id', field_type: 'simple' },
      { source_field: 'legacy_id', target_field: 'external_id', field_type: 'simple' },
    ]),
  })

  assert.deepEqual(
    findField(trace, 'external_id').producers.map((mapping) => mapping.sourceField),
    ['id', 'legacy_id'],
  )
})

test('preserva múltiples consumidores del mismo campo canónico', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      { source_field: 'external_id', target_field: 'IdentificacionExterna', field_type: 'simple' },
      { source_field: 'external_id', target_field: 'Referencia', field_type: 'simple' },
    ]),
  })

  assert.deepEqual(
    findField(trace, 'external_id').consumers.map((mapping) => mapping.targetPath),
    ['IdentificacionExterna', 'Referencia'],
  )
})

test('excluye constantes outbound del canónico y las envía a una sección separada', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      {
        source_field: '**constant**',
        target_field: 'Cliente',
        field_type: 'constant',
        constant_value: 'CF',
      },
    ]),
  })

  assert.deepEqual(trace.fields, [])
  assert.equal(trace.outboundConstants.length, 1)
  assert.equal(trace.outboundConstants[0].targetPath, 'Cliente')
  assert.equal(trace.outboundConstants[0].constantValue, 'CF')
})

test('trata una constante inbound como productor canónico sin source real', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: '**constant**',
        target_field: 'channel',
        field_type: 'constant',
        value: 'web',
      },
    ]),
  })
  const producer = findField(trace, 'channel').producers[0]

  assert.equal(producer.sourceField, null)
  assert.equal(producer.constantValue, 'web')
})

test('preserva lookup_table_code sin resolver el contenido de la tabla', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      {
        source_field: 'currency',
        target_field: 'MonedaCodigo',
        field_type: 'lookup',
        lookup_table_code: 'FinnegansMonedaMap',
      },
    ]),
  })

  assert.equal(findField(trace, 'currency').consumers[0].lookupTableCode, 'FinnegansMonedaMap')
})

test('preserva una expression como configuración sin parsear dependencias', () => {
  const expression = 'float(price) * quantity'
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      { target_field: 'total', field_type: 'expression', expression },
    ]),
  })

  assert.deepEqual(trace.fields.map((field) => field.canonicalField), ['total'])
  assert.equal(findField(trace, 'total').producers[0].expression, expression)
  assert.equal(findField(trace, 'total').producers[0].sourceField, '')
})

test('preserva formatos datetime de origen y destino', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'created_at',
        target_field: 'ordered_at',
        field_type: 'datetime',
        source_format: '%Y-%m-%d',
        target_format: 'iso',
      },
    ]),
  })
  const mapping = findField(trace, 'ordered_at').producers[0]

  assert.equal(mapping.sourceFormat, '%Y-%m-%d')
  assert.equal(mapping.targetFormat, 'iso')
})

test('relaciona table y sus sub_mappings conservando contexto de arrays', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'products',
        target_field: 'lines',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'sku', field_type: 'simple' },
        ],
      },
    ]),
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
        ],
      },
    ]),
  })

  assert.equal(findField(trace, 'lines').containerType, 'table')
  assert.equal(findField(trace, 'lines[].sku').producers[0].sourceField, 'sku')
  assert.equal(findField(trace, 'lines[].sku').consumers[0].targetPath, 'Items[].ProductoCodigo')
})

test('representa nested_object sin reescribir el source path configurado', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'shipping_address',
        target_field: 'shipping_address',
        field_type: 'nested_object',
        sub_mappings: [
          {
            source_field: 'shipping_address.city',
            target_field: 'city',
            field_type: 'path',
          },
        ],
      },
    ]),
  })
  const child = findField(trace, 'shipping_address.city')

  assert.equal(child.producers[0].sourceField, 'shipping_address.city')
  assert.equal(child.canonicalPath, 'shipping_address.city')
})

test('recorre estructuras anidadas recursivas preservando cada contenedor', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'products',
        target_field: 'lines',
        field_type: 'table',
        sub_mappings: [
          {
            source_field: 'details',
            target_field: 'details',
            field_type: 'nested_object',
            sub_mappings: [
              { source_field: 'raw_sku', target_field: 'sku', field_type: 'simple' },
            ],
          },
        ],
      },
    ]),
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          {
            source_field: 'details',
            target_field: 'Detalle',
            field_type: 'nested_object',
            sub_mappings: [
              { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
            ],
          },
        ],
      },
    ]),
  })

  const nested = findField(trace, 'lines[].details.sku')
  assert.equal(nested.producers[0].sourceField, 'raw_sku')
  assert.equal(nested.consumers[0].targetPath, 'Items[].Detalle.ProductoCodigo')
})

test('dos tables homónimas conservan hijos diferentes en ramas independientes', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'products_a',
        target_field: 'lines',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'a_sku', target_field: 'sku_a', field_type: 'simple' },
        ],
      },
      {
        source_field: 'products_b',
        target_field: 'lines',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'b_sku', target_field: 'sku_b', field_type: 'simple' },
        ],
      },
    ]),
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku_a', target_field: 'ProductoCodigo', field_type: 'simple' },
        ],
      },
    ]),
  })
  const lines = findField(trace, 'lines')

  assert.deepEqual(lines.branches.map((branch) => branch.kind), [
    'producer',
    'producer',
    'consumer',
  ])
  assert.deepEqual(
    lines.branches.map((branch) => branch.producer?.sourceField ?? null),
    ['products_a', 'products_b', null],
  )
  assert.deepEqual(
    lines.branches.map((branch) => branch.children.map((child) => child.canonicalField)),
    [['sku_a'], ['sku_b'], ['sku_a']],
  )
  assert.ok(lines.branches.every((branch) => (
    branch.children.every((child) => (
      child.producers.length === 0 || child.consumers.length === 0
    ))
  )))
})

test('table y nested_object homónimos no se fusionan ni aplican precedencia de tipo', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'products',
        target_field: 'lines',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'table_sku', target_field: 'sku', field_type: 'simple' },
        ],
      },
      {
        source_field: 'detail',
        target_field: 'lines',
        field_type: 'nested_object',
        sub_mappings: [
          { source_field: 'nested_sku', target_field: 'sku', field_type: 'simple' },
        ],
      },
    ]),
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'ProductoCodigo', field_type: 'simple' },
        ],
      },
    ]),
  })
  const lines = findField(trace, 'lines')

  assert.equal(lines.containerType, '')
  assert.deepEqual(
    lines.branches.map((branch) => branch.containerType),
    ['table', 'nested_object', 'table'],
  )
  assert.deepEqual(
    lines.branches.map((branch) => branch.children[0].canonicalPath),
    ['lines[].sku', 'lines.sku', 'lines[].sku'],
  )
  assert.equal(lines.branches[0].children[0].producers[0].sourceField, 'table_sku')
  assert.equal(lines.branches[1].children[0].producers[0].sourceField, 'nested_sku')
  assert.equal(lines.branches[2].children[0].consumers[0].targetPath, 'Items[].ProductoCodigo')
})

test('hijos con el mismo nombre bajo mappings padres distintos no se cruzan', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
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
        field_type: 'table',
        sub_mappings: [
          { source_field: 'b_sku', target_field: 'sku', field_type: 'simple' },
        ],
      },
    ]),
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'Producto', field_type: 'simple' },
        ],
      },
    ]),
  })
  const skuFields = findFields(trace, 'lines[].sku')

  assert.equal(skuFields.length, 3)
  assert.deepEqual(
    skuFields.map((field) => field.producers.map((mapping) => mapping.sourceField)),
    [['a_sku'], ['b_sku'], []],
  )
  assert.deepEqual(
    skuFields.map((field) => field.consumers.map((mapping) => mapping.targetPath)),
    [[], [], ['Items[].Producto']],
  )
})

test('múltiples consumers estructurales no generan asociaciones hijas inventadas', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([
      {
        source_field: 'products',
        target_field: 'lines',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'sku', field_type: 'simple' },
        ],
      },
    ]),
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'ItemsA',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'ProductoA', field_type: 'simple' },
        ],
      },
      {
        source_field: 'lines',
        target_field: 'ItemsB',
        field_type: 'table',
        sub_mappings: [
          { source_field: 'sku', target_field: 'ProductoB', field_type: 'simple' },
        ],
      },
    ]),
  })
  const lines = findField(trace, 'lines')

  assert.deepEqual(lines.branches.map((branch) => branch.kind), [
    'producer',
    'consumer',
    'consumer',
  ])
  assert.deepEqual(
    lines.branches.slice(1).map((branch) => branch.children[0].consumers[0].targetPath),
    ['ItemsA[].ProductoA', 'ItemsB[].ProductoB'],
  )
  assert.ok(lines.branches.every((branch) => (
    branch.children.every((child) => (
      child.producers.length === 0 || child.consumers.length === 0
    ))
  )))
})

test('una expression outbound con source_field permanece como consumer normal', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      {
        source_field: 'total',
        target_field: 'TotalCalculado',
        field_type: 'expression',
        expression: 'round(total, 2)',
      },
    ]),
  })

  assert.equal(findField(trace, 'total').consumers.length, 1)
  assert.equal(findField(trace, 'total').consumers[0].expression, 'round(total, 2)')
  assert.deepEqual(trace.unassociatedOutboundRules, [])
})

test('una expression outbound sin source_field se conserva sin inferir dependencias', () => {
  const expression = 'foo + bar'
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      {
        target_field: 'TotalCalculado',
        field_type: 'expression',
        expression,
      },
    ]),
  })

  assert.deepEqual(trace.fields, [])
  assert.equal(trace.unassociatedOutboundRules.length, 1)
  assert.equal(trace.unassociatedOutboundRules[0].targetPath, 'TotalCalculado')
  assert.equal(trace.unassociatedOutboundRules[0].expression, expression)
  assert.equal(findField(trace, 'foo'), undefined)
  assert.equal(findField(trace, 'bar'), undefined)
})

test('una expression hija sin source_field se conserva con su destino anidado', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          {
            target_field: 'TotalCalculado',
            field_type: 'expression',
            expression: 'price * quantity',
          },
        ],
      },
    ]),
  })

  assert.equal(findField(trace, 'lines').consumers.length, 1)
  assert.equal(trace.unassociatedOutboundRules.length, 1)
  assert.equal(trace.unassociatedOutboundRules[0].targetPath, 'Items[].TotalCalculado')
  assert.equal(trace.unassociatedOutboundRules[0].expression, 'price * quantity')
})

for (const [label, value] of [
  ['false', false],
  ['cero', 0],
  ['null', null],
  ['string vacío', ''],
]) {
  test(`preserva el valor falsy ${label} de una constante outbound`, () => {
    const trace = buildCanonicalFlowTrace({
      outboundProfile: profile([
        {
          source_field: '**constant**',
          target_field: 'ValorFijo',
          field_type: 'constant',
          constant_value: value,
          value: 'fallback que no debe usarse',
        },
      ]),
    })

    assert.equal(trace.outboundConstants.length, 1)
    assert.deepEqual(trace.outboundConstants[0].constantValue, value)
  })
}

test('una constante outbound anidada permanece fuera de consumers canónicos', () => {
  const trace = buildCanonicalFlowTrace({
    outboundProfile: profile([
      {
        source_field: 'lines',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          {
            source_field: '**constant**',
            target_field: 'Activo',
            field_type: 'constant',
            constant_value: false,
          },
        ],
      },
    ]),
  })

  assert.equal(trace.outboundConstants.length, 1)
  assert.equal(trace.outboundConstants[0].targetPath, 'Items[].Activo')
  assert.equal(trace.outboundConstants[0].constantValue, false)
  assert.equal(findField(trace, 'lines').branches[0].children.length, 0)
  assert.equal(findField(trace, 'Activo'), undefined)
})

test('campos duplicados exactos permanecen como entradas independientes', () => {
  const duplicate = { source_field: 'id', target_field: 'external_id', field_type: 'simple' }
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile([duplicate, { ...duplicate }]),
  })

  assert.equal(findField(trace, 'external_id').producers.length, 2)
})

test('no utiliza config.field_mappings legacy como fuente de trazabilidad', () => {
  const trace = buildCanonicalFlowTrace({
    inboundProfile: profile({
      field_mappings: [
        { source_field: 'legacy', target_field: 'legacy_target', field_type: 'simple' },
      ],
    }),
  })

  assert.deepEqual(trace, {
    fields: [],
    outboundConstants: [],
    unassociatedOutboundRules: [],
  })
})

test('sin profiles reales devuelve una trazabilidad vacía y no aplica presets', () => {
  assert.deepEqual(
    buildCanonicalFlowTrace(),
    { fields: [], outboundConstants: [], unassociatedOutboundRules: [] },
  )
})
