import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CONSTANT_SOURCE_FIELD,
  getMappingValidationErrors,
  mapBackendMappingListToForm,
  normalizeBackendMappingList,
} from '../src/services/adapters/mappingAdapter.js'
import { normalizeFieldTypesCatalog } from '../src/services/adapters/metadataAdapter.js'
import { buildBackendProfilePayload } from '../src/services/adapters/profileAdapter.js'
import {
  MAPPING_PROFILE_PRESETS,
  getLookupTablePreset,
  getMappingProfilePreset,
  shouldShowCreationPresets,
} from '../src/constants/onboardingPresets.js'

const runbook = readFileSync(
  new URL('../docs/api/onboarding-tienda-nube.md', import.meta.url),
  'utf8',
)

const extractJsonBlockAfter = (marker) => {
  const markerIndex = runbook.indexOf(marker)
  assert.notEqual(markerIndex, -1, `No se encontró la sección ${marker}`)

  const blockStart = runbook.indexOf('```json', markerIndex)
  const jsonStart = runbook.indexOf('\n', blockStart) + 1
  const jsonEnd = runbook.indexOf('```', jsonStart)

  return JSON.parse(runbook.slice(jsonStart, jsonEnd))
}

const flattenMappings = (mappings) => mappings.flatMap((mapping) => [
  mapping,
  ...Object.values(mapping)
    .filter(Array.isArray)
    .flatMap((value) => flattenMappings(
      value.filter((item) => item && typeof item === 'object' && !Array.isArray(item)),
    )),
])

test('el preset TiendaNubeStatusMap conserva el contrato real del runbook', () => {
  const preset = getLookupTablePreset('tiendanube-status-map')
  const expected = extractJsonBlockAfter('### Fase 1 — LookupTable de estados')

  assert.deepEqual(preset.values, expected)
  assert.deepEqual(Object.keys(preset.values).sort(), ['entries', 'name'])
})

test('el preset inbound conserva el runbook salvo por el contrato lookup vigente', () => {
  const preset = getMappingProfilePreset('tiendanube-sales-order-inbound')
  const expected = extractJsonBlockAfter('### Fase 2 — MappingProfile `tiendanube`')
  const expectedLookup = expected.config.find((mapping) => mapping.field_type === 'lookup')
  expectedLookup.lookup_table_code = expectedLookup.lookup_table_name
  delete expectedLookup.lookup_table_name

  assert.equal(preset.values.source_system, 'tiendanube')
  assert.equal(preset.values.entity, 'sales_order')
  assert.equal(preset.values.version, expected.version)
  assert.deepEqual(preset.values.config, expected.config)

  const lookup = preset.values.config.find((mapping) => mapping.field_type === 'lookup')
  assert.equal(lookup.lookup_table_code, 'TiendaNubeStatusMap')
  assert.equal('lookup_table_name' in lookup, false)
})

test('el preset Pedido de Venta representa el contrato funcional de Finnegans', () => {
  const preset = getMappingProfilePreset('finnegans-pedido-venta-outbound')
  const mappings = preset.values.config
  const byTarget = Object.fromEntries(mappings.map((mapping) => [mapping.target_field, mapping]))
  const constants = Object.fromEntries(
    mappings
      .filter((mapping) => mapping.field_type === 'constant')
      .map((mapping) => [mapping.target_field, mapping.value]),
  )
  const itemMappings = byTarget.Items.sub_mappings
  const itemByTarget = Object.fromEntries(
    itemMappings.map((mapping) => [mapping.target_field, mapping]),
  )

  assert.equal(preset.values.source_system, 'finnegans')
  assert.equal(preset.values.entity, 'sales_order')
  assert.equal(preset.values.version, '1.0.0')
  assert.equal(preset.values.is_active, true)
  assert.equal(byTarget.IdentificacionExterna.source_field, 'external_id')
  assert.equal(byTarget.Fecha.source_field, 'ordered_at')
  assert.equal(byTarget.Fecha.target_format, 'date')
  assert.deepEqual(constants, {
    Cliente: 'CF',
    CondicionPagoCodigo: 'CON',
    TransaccionTipoCodigo: 'OPER',
    TransaccionSubtipoCodigo: 'PDVTATN',
    WorkflowCodigo: 'VENTAS',
    EmpresaCodigo: 'DEMO',
  })
  assert.equal(byTarget.MonedaCodigo.source_field, 'currency')
  assert.equal(byTarget.MonedaCodigo.lookup_table_code, 'FinnegansMonedaMap')
  assert.equal('lookup_table_name' in byTarget.MonedaCodigo, false)
  assert.equal(byTarget.Items.source_field, 'lines')
  assert.equal(itemByTarget.ProductoCodigo.source_field, 'sku')
  assert.equal(itemByTarget.CantidadWorkflow.source_field, 'quantity')
  assert.equal(itemByTarget.Precio.source_field, 'unit_price')
  assert.equal(itemByTarget.Descuento1.source_field, 'discount_percent')
  assert.equal(itemByTarget.Descuento1.on_error, 'default')
  assert.equal(itemByTarget.Descuento1.default_value, '0')

  const targetFields = flattenMappings(mappings).map((mapping) => mapping.target_field)
  for (const legacyTarget of [
    'OrganizacionID',
    'MonedaID',
    'CondicionPagoID',
    'TransaccionTipoID',
    'TransaccionSubtipoID',
    'WorkflowID',
    'EmpresaID',
    'OperacionItems',
    'ProductoID',
  ]) {
    assert.equal(targetFields.includes(legacyTarget), false)
  }
  assert.equal(itemMappings.some((mapping) => mapping.target_field === 'IdentificacionExterna'), false)
})

test('Punto de Venta sólo precarga los datos respaldados por el runbook', () => {
  const preset = getMappingProfilePreset('finnegans-punto-venta-outbound')

  assert.equal(preset.values.source_system, 'finnegans_punto_venta')
  assert.equal(preset.values.entity, 'sales_order')
  assert.deepEqual(preset.values.config, [])
  assert.equal(preset.incomplete, true)
})

test('los getters entregan copias editables sin mutar las definiciones', () => {
  const editable = getMappingProfilePreset('tiendanube-sales-order-inbound')
  editable.values.config[0].target_field = 'edited'

  const fresh = getMappingProfilePreset('tiendanube-sales-order-inbound')
  assert.equal(fresh.values.config[0].target_field, 'external_id')
})

test('los presets sólo se ofrecen al crear y nunca se aplican al editar', () => {
  assert.equal(shouldShowCreationPresets(true, undefined), true)
  assert.equal(shouldShowCreationPresets(true, 'existing-resource-id'), false)
  assert.equal(shouldShowCreationPresets(false, undefined), false)
})

test('todos los payloads de profiles contienen sólo el contrato permitido', () => {
  const allowedFields = [
    'source_system',
    'entity',
    'version',
    'config',
    'is_active',
  ]
  const forbiddenFields = [
    'direction',
    'destination_system',
    'target_system',
    'inbound_profile_id',
    'outbound_profile_id',
    'canonical_schema_version',
    'metadata',
    'profiles',
  ]

  MAPPING_PROFILE_PRESETS.forEach((preset) => {
    const payload = buildBackendProfilePayload(preset.values)

    assert.deepEqual(Object.keys(payload), allowedFields)
    forbiddenFields.forEach((field) => assert.equal(field in payload, false))
  })
})

test('la normalización conserva sentinel, on_error y mappings anidados', () => {
  const preset = getMappingProfilePreset('finnegans-pedido-venta-outbound')
  const normalized = normalizeBackendMappingList(preset.values.config)
  const mappings = flattenMappings(normalized)
  const constants = mappings.filter((mapping) => mapping.field_type === 'constant')

  assert.ok(constants.length > 0)
  constants.forEach((mapping) => {
    assert.equal(mapping.source_field, CONSTANT_SOURCE_FIELD)
    assert.equal('constant_value' in mapping, false)
  })
  mappings.forEach((mapping) => assert.ok(mapping.on_error))
})

test('serializa referencias lookup legacy con lookup_table_code de forma recursiva', () => {
  const payload = buildBackendProfilePayload({
    source_system: 'legacy',
    source_entity: 'sales_order',
    version: '1.0.0',
    active: true,
    config: [
      {
        source_field: 'status',
        target_field: 'status',
        field_type: 'lookup',
        lookup_table_name: 'LegacyMap',
      },
      {
        source_field: 'items',
        target_field: 'Items',
        field_type: 'table',
        sub_mappings: [
          {
            source_field: 'currency',
            target_field: 'MonedaCodigo',
            field_type: 'lookup',
            lookup_table_name: 'NestedLegacyMap',
          },
        ],
      },
    ],
  })

  assert.equal(payload.config[0].lookup_table_code, 'LegacyMap')
  assert.equal('lookup_table_name' in payload.config[0], false)
  assert.equal(payload.config[1].sub_mappings[0].lookup_table_code, 'NestedLegacyMap')
  assert.equal('lookup_table_name' in payload.config[1].sub_mappings[0], false)
})

test('conserva lookup_table_code y le da prioridad sobre el nombre legacy', () => {
  const normalized = normalizeBackendMappingList([
    {
      source_field: 'currency',
      target_field: 'MonedaCodigo',
      field_type: 'lookup',
      lookup_table_code: 'CurrentMap',
      lookup_table_name: 'LegacyMap',
    },
  ])

  assert.equal(normalized[0].lookup_table_code, 'CurrentMap')
  assert.equal('lookup_table_name' in normalized[0], false)
})

test('carga referencias lookup legacy al formato vigente, incluso anidadas', () => {
  const formMappings = mapBackendMappingListToForm([
    {
      source_field: 'status',
      target_field: 'status',
      field_type: 'lookup',
      lookup_table_name: 'LegacyMap',
      lookup_table_code: 'CurrentMap',
      sub_mappings: [
        {
          source_field: 'currency',
          target_field: 'currency',
          field_type: 'lookup',
          lookup_table_name: 'NestedLegacyMap',
        },
      ],
    },
  ])

  assert.equal(formMappings[0].lookup_table_code, 'CurrentMap')
  assert.equal('lookup_table_name' in formMappings[0], false)
  assert.equal(formMappings[0].sub_mappings[0].lookup_table_code, 'NestedLegacyMap')
  assert.equal('lookup_table_name' in formMappings[0].sub_mappings[0], false)
})

test('metadata conserva lookup_table_code como clave de configuración de UI', () => {
  const metadata = normalizeFieldTypesCatalog({
    field_types: [
      {
        value: 'lookup',
        config_fields: [
          { name: 'lookup_table_code', type: 'string', required: true },
        ],
      },
    ],
  })

  assert.deepEqual(metadata.fieldTypeConfigFields.lookup, [
    {
      name: 'lookup_table_code',
      label: 'Tabla de consulta',
      type: 'string',
      required: true,
    },
  ])
})

test('la config inbound exacta conserva la validación recursiva de list[mapper]', () => {
  const preset = getMappingProfilePreset('tiendanube-sales-order-inbound')
  const fieldTypeValues = [
    'simple',
    'path',
    'constant',
    'datetime',
    'expression',
    'lookup',
    'table',
    'nested_object',
  ]
  const validationMetadata = {
    fieldTypes: fieldTypeValues.map((value) => ({ value })),
    onErrorStrategies: ['fail', 'skip', 'default'].map((value) => ({ value })),
    fieldTypeConfigFields: {
      expression: [{ name: 'expression', type: 'string', required: true }],
      lookup: [{ name: 'lookup_table_code', type: 'string', required: true }],
      table: [{ name: 'sub_mappings', type: 'list[mapper]', required: true }],
      nested_object: [{ name: 'sub_mappings', type: 'list[mapper]', required: true }],
    },
  }

  assert.deepEqual(
    getMappingValidationErrors(preset.values.config, validationMetadata),
    [],
  )

  const invalid = getMappingProfilePreset('tiendanube-sales-order-inbound')
  invalid.values.config[10].sub_mappings[0].target_field = ''
  assert.match(
    getMappingValidationErrors(invalid.values.config, validationMetadata)[0],
    /sub_mappings 1: falta target_field/,
  )

  invalid.values.config[10].sub_mappings[0].target_field = 'product_id'
  invalid.values.config[10].sub_mappings[1].source_field = ''
  assert.match(
    getMappingValidationErrors(invalid.values.config, validationMetadata)[0],
    /sub_mappings 2: falta source_field/,
  )
})
