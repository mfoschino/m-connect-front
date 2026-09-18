import assert from 'node:assert/strict'
import test from 'node:test'
import { getApiErrorMessage } from '../src/services/adapters/apiErrorAdapter.js'

test('normalizes a FastAPI string detail to renderable text', () => {
  assert.equal(
    getApiErrorMessage({ response: { data: { detail: 'Perfil duplicado' } } }),
    'Perfil duplicado',
  )
})

test('normalizes a FastAPI detail array with validation locations', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        detail: [
          { loc: ['body', 'version'], msg: 'Invalid version' },
          { loc: ['body', 'config', 0], msg: 'Invalid mapping' },
        ],
      },
    },
  })

  assert.equal(message, 'version: Invalid version · config.0: Invalid mapping')
  assert.equal(typeof message, 'string')
})

test('never returns an unexpected detail object to React', () => {
  const fallback = 'No se pudo guardar el perfil.'
  const message = getApiErrorMessage({ response: { data: { detail: { unexpected: true } } } }, fallback)

  assert.equal(message, fallback)
  assert.equal(typeof message, 'string')
})

test('uses an Error message for a network failure without response', () => {
  assert.equal(getApiErrorMessage(new Error('Network Error')), 'Network Error')
})
