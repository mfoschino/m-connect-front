/**
 * Schedule utilities
 * Converts business-friendly schedule inputs to cron expressions
 * Handles the translation from UI concepts to backend cron format
 */

export const SCHEDULE_PRESETS = [
  {
    id: 'manual',
    label: 'Manual Only',
    description: 'Run only when triggered manually',
    cron: null,
  },
  {
    id: 'hourly',
    label: 'Every Hour',
    description: 'Runs at the start of every hour',
    cron: '0 * * * *',
  },
  {
    id: 'daily-midnight',
    label: 'Daily at Midnight',
    description: 'Runs every day at 00:00 (UTC)',
    cron: '0 0 * * *',
  },
  {
    id: 'daily-custom',
    label: 'Daily at Custom Time',
    description: 'Choose a specific time each day',
    cron: null, // Requires time picker
  },
  {
    id: 'weekly-monday',
    label: 'Weekly on Monday',
    description: 'Runs every Monday at 00:00',
    cron: '0 0 * * 1',
  },
  {
    id: 'weekly-custom',
    label: 'Weekly on Custom Day',
    description: 'Choose a specific day and time',
    cron: null, // Requires day and time picker
  },
  {
    id: 'monthly',
    label: 'Monthly',
    description: 'Runs on the first day of each month at 00:00',
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
      return 'Every hour'
    case 'daily-midnight':
      return 'Daily at midnight'
    case 'daily-custom':
      return `Daily at ${timeStr}`
    case 'weekly-monday':
      return 'Every Monday'
    case 'weekly-custom': {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      return `Every ${days[dayOfWeek]} at ${timeStr}`
    }
    case 'monthly':
      return 'First of each month'
    case 'monthly-custom':
      return `Day ${dayOfMonth} of each month at ${timeStr}`
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
  if (!cron) return 'Manual (no automatic runs)'

  const now = new Date()
  const parsed = parseCron(cron)

  if (!parsed) return 'Unknown schedule'

  const { type, hour, minute } = parsed

  switch (type) {
    case 'hourly': {
      const next = new Date(now)
      next.setHours(next.getHours() + 1, 0, 0, 0)
      return `Next hour at ${formatTimeString(next.getHours(), 0)}`
    }
    case 'daily-midnight':
    case 'daily-custom': {
      const next = new Date(now)
      next.setDate(next.getDate() + 1)
      next.setHours(hour, minute, 0, 0)
      return `Tomorrow at ${formatTimeString(hour, minute)}`
    }
    case 'monthly':
      return 'First of next month'
    default:
      return 'Soon'
  }
}
