const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const normalizeExecutionsResponse = (response) => {
  if (Array.isArray(response)) return response.filter(isObject)
  if (!isObject(response)) return []

  for (const key of ['items', 'executions', 'data']) {
    if (Array.isArray(response[key])) return response[key]
  }

  if (isObject(response.data)) return normalizeExecutionsResponse(response.data)

  return []
}

export const getExecutionIdentifier = (execution) => {
  if (!isObject(execution)) return ''

  return execution.trace_id ?? execution.id ?? execution.task_id ?? ''
}
