const isObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const formatValidationError = (validationError) => {
  if (typeof validationError === 'string') return validationError.trim()
  if (!isObject(validationError)) return ''

  const location = Array.isArray(validationError.loc)
    ? validationError.loc
      .filter((segment) => segment !== 'body')
      .map(String)
      .join('.')
    : ''
  const message = typeof validationError.msg === 'string'
    ? validationError.msg.trim()
    : ''

  if (location && message) return `${location}: ${message}`
  return message || location
}

export const getApiErrorMessage = (
  error,
  fallback = 'Ocurrió un error inesperado. Intenta de nuevo.',
) => {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail.trim()

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

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}
