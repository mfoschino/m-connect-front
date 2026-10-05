import apiClient from './client'
import { normalizeExecutionsResponse } from '../adapters/executionAdapter'

const listExecutions = async ({ integration_id } = {}) => {
  const response = await apiClient.get('/executions', {
    params: integration_id ? { integration_id } : {},
  })
  return {
    ...response,
    data: normalizeExecutionsResponse(response.data),
  }
}
const getExecution = (traceId) => apiClient.get(`/executions/${traceId}`)
const getExecutionLogs = (traceId) => apiClient.get(`/executions/${traceId}/logs`)
const listIntegrations = () => apiClient.get('/integrations')

export default {
  listExecutions,
  getExecution,
  getExecutionLogs,
  listIntegrations,
}
