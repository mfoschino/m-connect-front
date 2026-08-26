/**
 * Schedule utilities
 * Converts business-friendly schedule inputs to cron expressions
 * Handles the translation from UI concepts to backend cron format
 */

export const SCHEDULE_PRESETS = [
  {
    id: 'manual',
    label: 'Solo manual',
    description: 'Se ejecuta únicamente cuando se inicia manualmente',
    cron: null,
  },
  {
    id: 'hourly',
    label: 'Cada hora',
    description: 'Se ejecuta al comienzo de cada hora',
    cron: '0 * * * *',
  },
  {
    id: 'daily-midnight',
    label: 'Todos los días a medianoche',
    description: 'Se ejecuta todos los días a las 00:00 (UTC)',
    cron: '0 0 * * *',
  },
  {
    id: 'daily-custom',
    label: 'Diaria en un horario personalizado',
    description: 'Elegí una hora específica para cada día',
    cron: null, // Requires time picker
  },
  {
    id: 'weekly-monday',
    label: 'Semanal, los lunes',
    description: 'Se ejecuta todos los lunes a las 00:00',
    cron: '0 0 * * 1',
  },
  {
    id: 'weekly-custom',
    label: 'Semanal en un día personalizado',
    description: 'Elegí un día y una hora específicos',
    cron: null, // Requires day and time picker
  },
  {
    id: 'monthly',
    label: 'Mensual',
    description: 'Se ejecuta el primer día de cada mes a las 00:00',
    cron: '0 0 1 * *',
  },
]

/**
 * Convert time string (HH:MM) to hour and minute values
 */
export const parseTimeString = (timeStr) => {
  if (!timeStr) return { hour: 0, minute: 0 }
  const [hour, minute] = timeStr.split(':').map(Number)
  return { hour: hour || 0, minute: minute || 0 }
}

/**
 * Format hour and minute to time string (HH:MM)
 */
export const formatTimeString = (hour, minute) => {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Generate cron expression for daily schedule with custom time
 */
export const generateDailyCron = (hour, minute) => {
  return `${minute} ${hour} * * *`
}

/**
 * Generate cron expression for weekly schedule
 */
export const generateWeeklyCron = (dayOfWeek, hour, minute) => {
  // dayOfWeek: 0 (Sunday) to 6 (Saturday), but cron uses 0 (Sunday) to 6 (Saturday)
  // Adjust: JavaScript Date getDay() uses 0 for Sunday, cron also uses 0 for Sunday
  const cronDay = dayOfWeek === 0 ? 0 : dayOfWeek
  return `${minute} ${hour} * * ${cronDay}`
}

/**
 * Generate cron expression for monthly schedule
 */
export const generateMonthlyCron = (dayOfMonth, hour, minute) => {
  return `${minute} ${hour} ${dayOfMonth} * *`
}

/**
 * Parse cron expression back to human-readable format
 * Returns null if cron doesn't match known presets
 */
export const parseCron = (cron) => {
  if (!cron) return { type: 'manual', hour: 0, minute: 0 }

  const parts = cron.split(' ')
  if (parts.length !== 5) return null

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts.map(Number)

  // Check if matches daily at midnight
  if (hour === 0 && minute === 0 && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { type: 'daily-midnight', hour: 0, minute: 0 }
  }

  // Check if matches hourly
  if (hour === '*' && minute === 0 && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { type: 'hourly', hour, minute }
  }

  // Check if matches weekly on Monday
  if (hour === 0 && minute === 0 && dayOfMonth === '*' && month === '*' && dayOfWeek === 1) {
    return { type: 'weekly-monday', hour: 0, minute: 0 }
  }

  // Check if matches monthly
  if (hour === 0 && minute === 0 && dayOfMonth === 1 && month === '*' && dayOfWeek === '*') {
    return { type: 'monthly', hour: 0, minute: 0 }
  }

  // Generic daily custom
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { type: 'daily-custom', hour, minute }
  }

  // Generic weekly custom
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    return { type: 'weekly-custom', hour, minute, dayOfWeek }
  }

  // Generic monthly custom
  if (month === '*' && dayOfWeek === '*' && dayOfMonth !== '*') {
    return { type: 'monthly-custom', hour, minute, dayOfMonth }
  }

  // Unknown format - return generic custom
  return { type: 'custom', cron, hour, minute }
}

/**
 * Get human-readable schedule description
 */
export const getScheduleDescription = (cron) => {
  if (!cron) return 'Manual'

  const preset = SCHEDULE_PRESETS.find((p) => p.cron === cron)
  if (preset) return preset.label

  const parsed = parseCron(cron)
  if (!parsed) return cron

  const { type, hour, minute, dayOfWeek, dayOfMonth } = parsed

  const timeStr = formatTimeString(hour, minute)

  switch (type) {
    case 'hourly':
      return 'Cada hora'
    case 'daily-midnight':
      return 'Todos los días a medianoche'
    case 'daily-custom':
      return `Todos los días a las ${timeStr}`
    case 'weekly-monday':
      return 'Todos los lunes'
    case 'weekly-custom': {
      const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
      return `Todos los ${days[dayOfWeek]} a las ${timeStr}`
    }
    case 'monthly':
      return 'El primer día de cada mes'
    case 'monthly-custom':
      return `El día ${dayOfMonth} de cada mes a las ${timeStr}`
    default:
      return cron
  }
}

/**
 * Calculate next run datetime from cron
 * Returns a human-readable string like "Tomorrow at 10:30 AM"
 * 
 * TODO: Implement full cron parser for accurate next-run calculation
 * For now, returns a simple estimate
 */
export const getNextRunEstimate = (cron) => {
  if (!cron) return 'Manual (sin ejecuciones automáticas)'

  const now = new Date()
  const parsed = parseCron(cron)

  if (!parsed) return 'Programación desconocida'

  const { type, hour, minute } = parsed

  switch (type) {
    case 'hourly': {
      const next = new Date(now)
      next.setHours(next.getHours() + 1, 0, 0, 0)
      return `Próxima ejecución a las ${formatTimeString(next.getHours(), 0)}`
    }
    case 'daily-midnight':
    case 'daily-custom': {
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(hour, minute, 0, 0)
      return `Mañana a las ${formatTimeString(hour, minute)}`
    }
    case 'monthly':
      return 'El primer día del próximo mes'
    default:
      return 'Próximamente'
  }
}
