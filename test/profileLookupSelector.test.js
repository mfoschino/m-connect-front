import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'
import { buildLookupReferenceOptions } from '../src/services/adapters/lookupReferenceOptions.js'
import {
  getMappingValidationErrors,
  mapBackendMappingListToForm,
  normalizeBackendMappingList,
} from '../src/services/adapters/mappingAdapter.js'
import {
  buildBackendProfileCreatePayload,
  buildBackendProfileUpdatePayload,
} from '../src/services/adapters/profileAdapter.js'

const lookupTables = [
  { id: 'uuid-1', codigo: 'FinnegansMonedaMap', name: 'Monedas Finnegans', is_active: true },
  { id: 'uuid-2', codigo: 'TiendaNubeStatusMap', name: 'Estados Tienda Nube', is_active: false },
  { id: 'uuid-3', codigo: 'CodeOnly', is_active: true },
]

const lookupField = { name: 'lookup_table_code', label: 'Tabla de consulta', type: 'string', required: true }
const lookupMapping = (code = '') => ({
  source_field: 'currency',
  target_field: 'MonedaCodigo',
  field_type: 'lookup',
  on_error: 'fail',
  lookup_table_code: code,
})

let vite
let MappingConfigFields

before(async () => {
  vite = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  MappingConfigFields = (await vite.ssrLoadModule(
    '/src/components/integrations/MappingConfigFields.jsx',
  )).default
})

after(async () => {
  await vite?.close()
})

const renderFields = ({
  mapping = lookupMapping(),
  tables = lookupTables,
  fields = [lookupField],
  ...props
} = {}) => renderToString(React.createElement(MappingConfigFields, {
  fields,
  mapping,
  lookupTables: tables,
  onChange: () => {},
  mappingIndex: 2,
  ...props,
}))

const selectedOption = (html) => html.match(/<option\b[^>]*selected=""[^>]*>[^<]*<\/option>/)?.[0] ?? ''

test('options use codigo as value; name and inactive status affect only the label', () => {
  const options = buildLookupReferenceOptions(lookupTables)

  assert.deepEqual(options, [
    { value: 'FinnegansMonedaMap', label: 'FinnegansMonedaMap — Monedas Finnegans' },
    { value: 'TiendaNubeStatusMap', label: 'TiendaNubeStatusMap — Estados Tienda Nube — inactiva' },
    { value: 'CodeOnly', label: 'CodeOnly' },
  ])
  assert.equal(JSON.stringify(options).includes('uuid-'), false)
  assert.equal(JSON.stringify(options).includes('is_active'), false)
})

test('an existing code is selected in the labeled selector', () => {
  const html = renderFields({ mapping: lookupMapping('FinnegansMonedaMap') })

  assert.match(html, /<label for="mapping-config-lookup_table_code-2"/)
  assert.match(html, /<select[^>]*id="mapping-config-lookup_table_code-2"/)
  assert.match(selectedOption(html), /value="FinnegansMonedaMap"/)
  assert.match(html, /FinnegansMonedaMap — Monedas Finnegans/)
  assert.doesNotMatch(html, /value="uuid-1"|value="Monedas Finnegans"/)
})

test('create can render a lookup selector with an empty reference', () => {
  const html = renderFields({ mapping: lookupMapping('') })

  assert.match(html, /Seleccionar LookupTable/)
  assert.match(selectedOption(html), /value=""/)
  assert.match(html, /value="FinnegansMonedaMap"/)
})

test('edit hydrates current and legacy references into the correct selection', () => {
  const current = mapBackendMappingListToForm([lookupMapping('FinnegansMonedaMap')])[0]
  const legacyOnly = mapBackendMappingListToForm([{
    source_field: 'currency',
    target_field: 'MonedaCodigo',
    field_type: 'lookup',
    lookup_table_name: 'FinnegansMonedaMap',
  }])[0]

  assert.match(selectedOption(renderFields({ mapping: current })), /value="FinnegansMonedaMap"/)
  assert.match(selectedOption(renderFields({ mapping: legacyOnly })), /value="FinnegansMonedaMap"/)
  assert.equal('lookup_table_name' in legacyOnly, false)
})

test('current code takes precedence when legacy name coexists', () => {
  const mapping = mapBackendMappingListToForm([{
    ...lookupMapping('TiendaNubeStatusMap'),
    lookup_table_name: 'FinnegansMonedaMap',
  }])[0]

  assert.equal(mapping.lookup_table_code, 'TiendaNubeStatusMap')
  assert.match(selectedOption(renderFields({ mapping })), /value="TiendaNubeStatusMap"/)
})

test('a missing current code remains selected and is labeled as unavailable', () => {
  const html = renderFields({ mapping: lookupMapping('LegacyLookup') })

  assert.match(selectedOption(html), /value="LegacyLookup"/)
  assert.match(html, /LegacyLookup — no disponible/)
  assert.match(html, /La referencia configurada no está disponible entre las LookupTables cargadas/)
  assert.match(html, /value="FinnegansMonedaMap"/)
})

test('an empty LookupTable collection preserves an existing code and renders a placeholder', () => {
  const missing = renderFields({ mapping: lookupMapping('LegacyLookup'), tables: [] })
  const empty = renderFields({ mapping: lookupMapping(''), tables: [] })

  assert.match(selectedOption(missing), /value="LegacyLookup"/)
  assert.match(missing, /No hay LookupTables disponibles/)
  assert.match(selectedOption(empty), /value=""/)
  assert.match(empty, /No hay LookupTables disponibles/)
  assert.deepEqual(buildLookupReferenceOptions(null), [])
})

test('inactive LookupTables remain selectable by codigo', () => {
  const html = renderFields({ mapping: lookupMapping('TiendaNubeStatusMap') })

  assert.match(selectedOption(html), /value="TiendaNubeStatusMap"/)
  assert.match(html, /TiendaNubeStatusMap — Estados Tienda Nube — inactiva/)
})

test('general LookupTable loading disables selection without replacing the current value', () => {
  const html = renderFields({ mapping: lookupMapping('LegacyLookup'), lookupTablesLoading: true })

  assert.match(html, /<select[^>]*disabled=""/)
  assert.match(html, /Cargando LookupTables/)
  assert.match(selectedOption(html), /value="LegacyLookup"/)
})

test('empty lookup reference follows metadata required rather than a new global rule', () => {
  const mapping = lookupMapping('')
  const metadata = {
    fieldTypes: [{ value: 'lookup' }],
    onErrorStrategies: [{ value: 'fail' }],
    fieldTypeConfigFields: { lookup: [lookupField] },
  }

  assert.match(getMappingValidationErrors([mapping], metadata)[0], /lookup_table_code/)
  assert.deepEqual(getMappingValidationErrors([mapping], {
    ...metadata,
    fieldTypeConfigFields: { lookup: [{ ...lookupField, required: false }] },
  }), [])
})

test('non-lookup mappings do not receive the LookupTable selector', () => {
  const html = renderFields({
    mapping: { ...lookupMapping('FinnegansMonedaMap'), field_type: 'simple' },
  })

  assert.doesNotMatch(html, /<select/)
  assert.match(html, /<input/)
})

test('legacy reference round-trips through UI to the current create and PATCH contracts', () => {
  const [mapping] = mapBackendMappingListToForm([{
    source_field: 'currency',
    target_field: 'MonedaCodigo',
    field_type: 'lookup',
    lookup_table_name: 'FinnegansMonedaMap',
  }])
  assert.match(selectedOption(renderFields({ mapping })), /value="FinnegansMonedaMap"/)

  const create = buildBackendProfileCreatePayload({
    source_system: 'finnegans',
    source_entity: 'sales_order',
    version: '1.0.0',
    active: true,
    config: [mapping],
  })
  const update = buildBackendProfileUpdatePayload({ version: '1.0.0', active: true, config: [mapping] })

  for (const payload of [create, update]) {
    assert.equal(payload.config[0].lookup_table_code, 'FinnegansMonedaMap')
    assert.equal('lookup_table_name' in payload.config[0], false)
    assert.equal('id' in payload.config[0], false)
    assert.equal('name' in payload.config[0], false)
  }
  assert.deepEqual(Object.keys(create), ['source_system', 'entity', 'version', 'config', 'is_active'])
  assert.deepEqual(Object.keys(update), ['config', 'version', 'is_active'])
})

test('changing an unavailable reference emits only lookup_table_code with the selected codigo', () => {
  const original = lookupMapping('LegacyLookup')
  const changes = []
  const tree = MappingConfigFields({
    fields: [lookupField],
    mapping: original,
    lookupTables,
    onChange: (key, value) => changes.push([key, value]),
    mappingIndex: 2,
  })
  const field = tree.props.children[0]
  const selector = field.props.children[1]
  selector.props.onChange({ target: { value: 'FinnegansMonedaMap' } })

  assert.deepEqual(changes, [['lookup_table_code', 'FinnegansMonedaMap']])
  assert.equal(original.lookup_table_code, 'LegacyLookup')
  selector.props.onChange({ target: { value: '' } })
  assert.deepEqual(changes[1], ['lookup_table_code', undefined])
})

test('lookup references inside sub_mappings keep recursive legacy normalization through JSON', () => {
  const config = [{
    source_field: 'items',
    target_field: 'Items',
    field_type: 'table',
    sub_mappings: [{
      source_field: 'currency',
      target_field: 'MonedaCodigo',
      field_type: 'lookup',
      lookup_table_name: 'FinnegansMonedaMap',
    }],
  }]
  const [formMapping] = mapBackendMappingListToForm(config)
  const [backendMapping] = normalizeBackendMappingList([formMapping])

  assert.equal(formMapping.sub_mappings[0].lookup_table_code, 'FinnegansMonedaMap')
  assert.equal(backendMapping.sub_mappings[0].lookup_table_code, 'FinnegansMonedaMap')
  assert.equal('lookup_table_name' in backendMapping.sub_mappings[0], false)
})

test('selector wiring stores only lookup_table_code and makes no per-mapping requests', async () => {
  const paths = [
    '../src/pages/integrations/Integrations.jsx',
    '../src/components/integrations/ProfileForm.jsx',
    '../src/components/integrations/FieldMappingBuilder.jsx',
    '../src/components/integrations/MappingConfigFields.jsx',
  ]
  const [page, form, builder, fields] = await Promise.all(paths.map((path) => (
    readFile(new URL(path, import.meta.url), 'utf8')
  )))

  assert.match(page, /lookupTables=\{lookupTables\}/)
  assert.match(form, /lookupTables=\{lookupTables\}/)
  assert.match(builder, /lookupTables=\{lookupTables\}/)
  assert.match(fields, /mapping\.field_type === 'lookup' && field\.name === 'lookup_table_code'/)
  assert.match(fields, /onChange=\{\(event\) => onChange\(field\.name, event\.target\.value \|\| undefined\)\}/)
  assert.match(builder, /onChange=\{\(key, value\) => handleConfigChange\(index, key, value\)\}/)
  assert.match(builder, /if \(value === undefined\) delete nextMapping\[key\]/)
  assert.match(builder, /else nextMapping\[key\] = value/)
  assert.match(page, /lookupService\.listLookupTables\(\)/)
  for (const source of [form, builder, fields]) {
    assert.doesNotMatch(source, /lookupService|apiClient|fetch\(/)
  }
})
