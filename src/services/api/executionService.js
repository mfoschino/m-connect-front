import apiClient from './client'

const listExecutions = () => apiClient.get('/executions')
const getExecution = (traceId) => apiClient.get(`/executions/${traceId}`)
const getExecutionLogs = (traceId) => apiClient.get(`/executions/${traceId}/logs`)
const listIntegrations = () => apiClient.get('/integrations')

export default {
  listExecutions,
  getExecution,
  getExecutionLogs,
  listIntegrations,
}
