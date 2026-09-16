import { isSensitiveConfigField } from './sensitiveConfigAdapter.js'

const PASSWORD_CAPABLE_FIELD_TYPES = new Set(['', 'json', 'password', 'secret', 'sensitive', 'text', 'textarea'])

export const CONNECTION_TEST_UNAVAILABLE_MESSAGE = (
  'La prueba de conexión todavía no está disponible. No se realizó ninguna validación ni solicitud.'
)

export const getConnectorFieldInputType = (field = {}) => {
  const fieldType = String(field.type ?? '').toLowerCase()
  return isSensitiveConfigField(field) && PASSWORD_CAPABLE_FIELD_TYPES.has(fieldType)
    ? 'password'
    : field.type
}

export const getNextConnectorConfig = (config = {}, field = {}, value) => ({
  ...config,
  [field.id]: field.nullable && value === '' ? null : value,
})

export const reportConnectionTestUnavailable = (setMessage) => {
  setMessage?.(CONNECTION_TEST_UNAVAILABLE_MESSAGE)
}
