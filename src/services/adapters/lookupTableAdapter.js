import { getApiErrorMessage } from './apiErrorAdapter.js'

export const LOOKUP_TABLE_CODE_PATTERN = /^[A-Za-z0-9_.-]+$/

const isObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const getEntriesText = (entries) => {
  if (typeof entries === 'string') return entries
  return isObject(entries) ? JSON.stringify(entries, null, 2) : '{}'
}

export const mapLookupTableToForm = (lookupTable = {}) => ({
  codigo: lookupTable?.codigo ?? '',
  name: lookupTable?.name ?? '',
  is_active: lookupTable?.is_active ?? true,
  entriesText: getEntriesText(lookupTable?.entries),
})

export const buildLookupTablePayload = (formValues = {}) => {
  const codigo = String(formValues.codigo ?? '').trim()
  const name = String(formValues.name ?? '').trim()

  if (!codigo) {
    return { error: 'El código de la tabla es obligatorio.' }
  }

  if (!LOOKUP_TABLE_CODE_PATTERN.test(codigo)) {
    return {
      error: 'El código sólo puede contener letras, números, guiones, guiones bajos y puntos.',
    }
  }

  if (!name) {
    return { error: 'El nombre descriptivo de la tabla es obligatorio.' }
  }

  let entries
  try {
    entries = JSON.parse(formValues.entriesText || '{}')
  } catch {
    return { error: 'Las entradas deben contener un objeto JSON válido.' }
  }

  if (!isObject(entries)) {
    return { error: 'Las entradas deben ser un objeto JSON de pares clave/valor.' }
  }

  if (Object.keys(entries).length === 0) {
    return { error: 'La tabla debe contener al menos una entrada.' }
  }

  if (Object.values(entries).some((value) => typeof value !== 'string')) {
    return { error: 'Todos los valores de las entradas deben ser strings.' }
  }

  return {
    error: '',
    payload: {
      codigo,
      name,
      is_active: formValues.is_active ?? true,
      entries,
    },
  }
}

export const getLookupApiErrorMessage = (
  error,
  fallback = 'Error al guardar la tabla de consulta.',
) => getApiErrorMessage(error, fallback)
