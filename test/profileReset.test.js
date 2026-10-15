import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildBackendProfileUpdatePayload,
  getResetProfileMappings,
} from '../src/services/adapters/profileAdapter.js'

const simpleConfig = [{
  source_field: 'id',
  target_field: 'external_id',
  field_type: 'simple',
  on_error: 'fail',
}]

const nestedConfig = [{
  source_field: 'items',
  target_field: 'Items',
  field_type: 'table',
  on_error: 'fail',
  sub_mappings: [
    {
      source_field: 'sku',
      target_field: 'ProductoCodigo',
      field_type: 'simple',
      on_error: 'fail',
    },
    {
      source_field: 'address',
      target_field: 'Direccion',
      field_type: 'nested_object',
      on_error: 'fail',
      sub_mappings: [{
        source_field: 'city',
        target_field: 'Ciudad',
        field_type: 'simple',
        on_error: 'fail',
      }],
    },
  ],
}]

test('a simple mapping returns to the original baseline after reset', () => {
  const baseline = getResetProfileMappings(simpleConfig)
  const editable = getResetProfileMappings(baseline)
  editable[0].target_field = 'changed'

  const restored = getResetProfileMappings(baseline)

  assert.deepEqual(restored, simpleConfig)
  assert.equal(restored[0].target_field, 'external_id')
})

test('table sub_mappings reset in state and remount the nested editor from the baseline', async () => {
  const baseline = getResetProfileMappings(nestedConfig)
  const editable = getResetProfileMappings(baseline)
  editable[0].sub_mappings[0].target_field = 'ChangedProduct'

  const restored = getResetProfileMappings(baseline)
  const formSource = await readFile(
    new URL('../src/components/integrations/ProfileForm.jsx', import.meta.url),
    'utf8',
  )

  assert.equal(restored[0].sub_mappings[0].target_field, 'ProductoCodigo')
  assert.match(formSource, /setMappingEditorRevision\(\(current\) => current \+ 1\)/)
  assert.match(formSource, /key=\{`\$\{selectedPresetId \|\| initialValues\?\.id \|\| 'profile-mappings'\}-\$\{mappingEditorRevision\}`\}/)
})

test('nested_object reset removes edited references across multiple levels', () => {
  const baseline = getResetProfileMappings(nestedConfig)
  const editable = getResetProfileMappings(baseline)
  const editedNested = editable[0].sub_mappings[1].sub_mappings[0]
  editedNested.target_field = 'ChangedCity'
  editedNested.extra = { path: ['edited'] }

  const restored = getResetProfileMappings(baseline)
  const restoredNested = restored[0].sub_mappings[1].sub_mappings[0]

  assert.equal(restoredNested.target_field, 'Ciudad')
  assert.equal('extra' in restoredNested, false)
  assert.notEqual(restored, editable)
  assert.notEqual(restored[0], editable[0])
  assert.notEqual(restoredNested, editedNested)
})

test('baseline, editable state and restored state have independent mutable references', () => {
  const source = [{
    ...nestedConfig[0],
    unknown_object: { rules: [{ values: ['one', 'two'] }] },
    unknown_array: [{ nested: { enabled: true } }],
  }]
  const baseline = getResetProfileMappings(source)
  const editable = getResetProfileMappings(baseline)
  const restored = getResetProfileMappings(baseline)

  editable[0].sub_mappings[0].target_field = 'Edited'
  editable[0].unknown_object.rules[0].values.push('edited')
  restored[0].unknown_array[0].nested.enabled = false

  assert.deepEqual(baseline, source)
  assert.equal(baseline[0].sub_mappings[0].target_field, 'ProductoCodigo')
  assert.deepEqual(baseline[0].unknown_object.rules[0].values, ['one', 'two'])
  assert.equal(baseline[0].unknown_array[0].nested.enabled, true)
  assert.notEqual(baseline, editable)
  assert.notEqual(baseline[0], editable[0])
  assert.notEqual(baseline[0].sub_mappings, editable[0].sub_mappings)
  assert.notEqual(baseline[0].unknown_object, editable[0].unknown_object)
  assert.notEqual(baseline[0].unknown_array[0], restored[0].unknown_array[0])
})

test('repeated resets always return to the same original baseline', () => {
  const baseline = getResetProfileMappings(nestedConfig)
  let editable = getResetProfileMappings(baseline)

  editable[0].sub_mappings[0].target_field = 'FirstEdit'
  editable = getResetProfileMappings(baseline)
  assert.deepEqual(editable, baseline)

  editable[0].sub_mappings[1].sub_mappings[0].target_field = 'SecondEdit'
  editable = getResetProfileMappings(baseline)
  assert.deepEqual(editable, baseline)
})

test('the PATCH payload after reset contains the original mappings', () => {
  const baseline = getResetProfileMappings(nestedConfig)
  const editable = getResetProfileMappings(baseline)
  editable[0].sub_mappings[0].target_field = 'VisuallyStaleValue'
  const restored = getResetProfileMappings(baseline)

  const payload = buildBackendProfileUpdatePayload({
    version: '1.0.0',
    active: true,
    config: restored,
  })

  assert.deepEqual(payload.config, nestedConfig)
  assert.equal(payload.config[0].sub_mappings[0].target_field, 'ProductoCodigo')
})
