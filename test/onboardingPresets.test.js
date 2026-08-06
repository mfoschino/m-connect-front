import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  CONSTANT_SOURCE_FIELD,
  getMappingValidationErrors,
  normalizeBackendMappingList,
} from '../src/services/adapters/mappingAdapter.js'
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

test('el preset inbound Tienda Nube replica exactamente la config documentada', () => {
  const preset = getMappingProfilePreset('tiendanube-sales-order-inbound')
  const expected = extractJsonBlockAfter('### Fase 2 — MappingProfile `tiendanube`')

  assert.equal(preset.values.source_system, 'tiendanube')
  assert.equal(preset.values.entity, 'sales_order')
  assert.equal(preset.values.version, expected.version)
  assert.deepEqual(preset.values.config, expected.config)
})

test('el preset Pedido de Venta replica exactamente la config documentada', () => {
  const preset = getMappingProfilePreset('finnegans-pedido-venta-outbound')
  const expected = extractJsonBlockAfter('**Paso 3 — Perfil de salida `pedidoVenta`**')

  assert.equal(preset.values.source_system, 'finnegans')
  assert.equal(preset.values.entity, 'sales_order')
  assert.deepEqual(preset.values.config, expected.config)
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
      lookup: [{ name: 'lookup_table_name', type: 'string', required: true }],
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
