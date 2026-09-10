import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLookupTablePayload,
  getLookupApiErrorMessage,
  mapLookupTableToForm,
} from '../src/services/adapters/lookupTableAdapter.js'

const validForm = {
  codigo: 'FinnegansMonedaMap',
  name: 'Mapa de monedas Finnegans',
  is_active: true,
  entriesText: JSON.stringify({ ARS: 'PES', USD: 'DOL' }),
}

test('initializes a create form without an existing LookupTable', () => {
  assert.deepEqual(mapLookupTableToForm({}), {
    codigo: '',
    name: '',
    is_active: true,
    entriesText: '{}',
  })
})

test('builds the exact LookupTable create payload', () => {
  assert.deepEqual(buildLookupTablePayload(validForm), {
    error: '',
    payload: {
      codigo: 'FinnegansMonedaMap',
      name: 'Mapa de monedas Finnegans',
      is_active: true,
      entries: { ARS: 'PES', USD: 'DOL' },
    },
  })
})

for (const [name, formValues, expectedError] of [
  ['empty codigo', { ...validForm, codigo: '' }, /código.+obligatorio/i],
  ['invalid codigo', { ...validForm, codigo: 'Moneda Map!' }, /sólo puede contener/i],
  ['empty name', { ...validForm, name: '' }, /nombre descriptivo.+obligatorio/i],
  ['invalid JSON', { ...validForm, entriesText: '{' }, /JSON válido/i],
  ['array entries', { ...validForm, entriesText: '[]' }, /objeto JSON/i],
  ['empty entries', { ...validForm, entriesText: '{}' }, /al menos una entrada/i],
  ['non-string entry values', { ...validForm, entriesText: '{"ARS": 1}' }, /deben ser strings/i],
]) {
  test(`rejects ${name}`, () => {
    const result = buildLookupTablePayload(formValues)

    assert.match(result.error, expectedError)
    assert.equal('payload' in result, false)
  })
}

test('hydrates and preserves all editable fields for update', () => {
  const existing = {
    codigo: 'TiendaNubeStatusMap',
    name: 'Estados de Tienda Nube',
    is_active: false,
    entries: { open: 'confirmed' },
  }
  const formValues = mapLookupTableToForm(existing)

  assert.deepEqual(formValues, {
    codigo: 'TiendaNubeStatusMap',
    name: 'Estados de Tienda Nube',
    is_active: false,
    entriesText: '{\n  "open": "confirmed"\n}',
  })
  assert.deepEqual(buildLookupTablePayload(formValues).payload, existing)
})

test('normalizes a string API detail', () => {
  assert.equal(
    getLookupApiErrorMessage({ response: { data: { detail: 'Código duplicado' } } }),
    'Código duplicado',
  )
})

test('normalizes multiple FastAPI validation errors with their locations', () => {
  const message = getLookupApiErrorMessage({
    response: {
      data: {
        detail: [
          { type: 'missing', loc: ['body', 'codigo'], msg: 'Field required' },
          { type: 'value_error', loc: ['body', 'entries'], msg: 'Must not be empty' },
        ],
      },
    },
  })

  assert.equal(message, 'codigo: Field required · entries: Must not be empty')
  assert.equal(typeof message, 'string')
})

test('falls back to the Error message and then to a generic string', () => {
  assert.equal(getLookupApiErrorMessage(new Error('Network error')), 'Network error')
  assert.equal(getLookupApiErrorMessage({}), 'Error al guardar la tabla de consulta.')
  assert.equal(typeof getLookupApiErrorMessage({ response: { data: { detail: {} } } }), 'string')
})
