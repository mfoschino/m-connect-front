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

const formatValidationError = (validationError) => {
  if (typeof validationError === 'string') return validationError
  if (!isObject(validationError)) return ''

  const location = Array.isArray(validationError.loc)
    ? validationError.loc
      .filter((segment) => segment !== 'body')
      .map(String)
      .join('.')
    : ''
  const message = typeof validationError.msg === 'string' ? validationError.msg : ''

  if (location && message) return `${location}: ${message}`
  return message || location
}

export const getLookupApiErrorMessage = (
  error,
  fallback = 'Error al guardar la tabla de consulta.',
) => {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const validationMessage = detail
      .map(formatValidationError)
      .filter(Boolean)
      .join(' · ')

    if (validationMessage) return validationMessage
  }

  if (isObject(detail)) {
    const validationMessage = formatValidationError(detail)
    if (validationMessage) return validationMessage
  }

  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}
