export const PAGE_SIZE = 20

// Quita los filtros vacíos, para no mandar "?status=" al backend (daría error 422)
export const cleanParams = (params) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )

// Lee el mensaje de error según la forma que manda el backend
export const getErrorMessage = (error, fallback) => {
  const data = error?.response?.data

  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => item.msg).filter(Boolean).join(' ') || fallback
  }

  return data?.detail || data?.error || fallback
}

export const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
]

export const ROLE_LABELS = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "2026-11-04" → el inicio de ese día (hora local), en el formato que espera el backend
export const startOfDayIso = (dateText) => {
  if (!dateText) return ''
  return new Date(`${dateText}T00:00:00`).toISOString()
}

// "2026-11-04" → el inicio del día SIGUIENTE.
// El filtro "until" no incluye ese instante, así que el 4 de noviembre entra completo.
export const startOfNextDayIso = (dateText) => {
  if (!dateText) return ''
  const date = new Date(`${dateText}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}