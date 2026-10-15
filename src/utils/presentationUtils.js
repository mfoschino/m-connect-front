const EXECUTION_STATUS_LABELS = {
  ok: 'Correcta',
  success: 'Exitosa',
  completed: 'Completada',
  error: 'Con error',
  failed: 'Fallida',
  pending: 'Pendiente',
  queued: 'En cola',
  processing: 'En proceso',
  running: 'En ejecución',
  retry: 'En reintento',
  retrying: 'Reintentando',
  cancelled: 'Cancelada',
  canceled: 'Cancelada',
  skipped: 'Omitida',
}

const LOG_LEVEL_LABELS = {
  error: 'Error',
  warning: 'Advertencia',
  warn: 'Advertencia',
  info: 'Información',
  debug: 'Depuración',
}

const CONNECTOR_TYPE_LABELS = {
  api: 'API',
  db: 'Base de datos',
  database: 'Base de datos',
  file: 'Archivo',
  webhook: 'Webhook',
}

const getMappedLabel = (labels, value, fallback = '—') => {
  if (value === undefined || value === null || value === '') return fallback
  return labels[String(value).trim().toLowerCase()] ?? String(value)
}

export const getExecutionStatusLabel = (status) => getMappedLabel(EXECUTION_STATUS_LABELS, status)

export const getLogLevelLabel = (level) => getMappedLabel(LOG_LEVEL_LABELS, level, 'N/D')

export const getConnectorTypeLabel = (type) => getMappedLabel(CONNECTOR_TYPE_LABELS, type, 'Flujo activo')
