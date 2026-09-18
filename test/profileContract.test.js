import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildBackendProfileCreatePayload,
  buildBackendProfileUpdatePayload,
  getProfileDisplayName,
  mapBackendProfileToForm,
} from '../src/services/adapters/profileAdapter.js'

const editableProfile = {
  id: 'profile-id',
  tenant_id: 'tenant-id',
  name: 'Legacy display name',
  source_system: 'tiendanube',
  source_entity: 'sales_order',
  version: '1.2.3',
  active: false,
  config: [
    {
      source_field: 'status',
      target_field: 'status',
      field_type: 'lookup',
      lookup_table_name: 'LegacyStatusMap',
      required: true,
    },
  ],
  created_at: '2026-09-17T10:00:00Z',
}

test('create serializa sólo la allowlist del contrato de MappingProfile', () => {
  const payload = buildBackendProfileCreatePayload(editableProfile)

  assert.deepEqual(Object.keys(payload), [
    'source_system',
    'entity',
    'version',
    'config',
    'is_active',
  ])
  assert.deepEqual(payload, {
    source_system: 'tiendanube',
    entity: 'sales_order',
    version: '1.2.3',
    config: [
      {
        source_field: 'status',
        target_field: 'status',
        field_type: 'lookup',
        lookup_table_code: 'LegacyStatusMap',
        on_error: 'fail',
      },
    ],
    is_active: false,
  })
})

test('update serializa sólo config, version e is_active', () => {
  const payload = buildBackendProfileUpdatePayload(editableProfile)

  assert.deepEqual(Object.keys(payload), [
    'config',
    'version',
    'is_active',
  ])
  assert.equal('source_system' in payload, false)
  assert.equal('entity' in payload, false)
  assert.equal('source_entity' in payload, false)
  assert.equal('name' in payload, false)
  assert.deepEqual(payload, {
    config: [
      {
        source_field: 'status',
        target_field: 'status',
        field_type: 'lookup',
        lookup_table_code: 'LegacyStatusMap',
        on_error: 'fail',
      },
    ],
    version: '1.2.3',
    is_active: false,
  })
})

test('hidrata un profile sin name y conserva aliases y mappings legacy', () => {
  const formValues = mapBackendProfileToForm({
    id: 'profile-id',
    source_system: 'tiendanube',
    source_entity: 'sales_order',
    version: '1.0.0',
    active: false,
    config: editableProfile.config,
  })

  assert.equal('name' in formValues, false)
  assert.equal(formValues.source_entity, 'sales_order')
  assert.equal(formValues.active, false)
  assert.equal(formValues.config[0].lookup_table_code, 'LegacyStatusMap')
  assert.equal('lookup_table_name' in formValues.config[0], false)
})

test('hidrata el contrato vigente sin descartar un name legacy recibido', () => {
  const formValues = mapBackendProfileToForm({
    name: 'Legacy display name',
    source_system: 'finnegans',
    entity: 'sales_order',
    version: '2.0.0',
    is_active: true,
    config: [],
  })

  assert.equal(formValues.name, 'Legacy display name')
  assert.equal(formValues.source_entity, 'sales_order')
  assert.equal(formValues.active, true)
  assert.deepEqual(formValues.config, [])
})

test('identifica el profile por campos persistidos y no por un name legacy', () => {
  assert.equal(
    getProfileDisplayName({
      name: 'Legacy display name',
      source_system: 'tiendanube',
      entity: 'sales_order',
      version: '1.0.0',
    }),
    'tiendanube · sales_order · 1.0.0',
  )
})
