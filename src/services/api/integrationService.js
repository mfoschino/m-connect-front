import apiClient from './client'

const listIntegrations = () => apiClient.get('/integrations')
const getIntegration = (integrationId) => apiClient.get(`/integrations/${integrationId}`)
const createIntegration = (payload) => apiClient.post('/integrations', payload)
const updateIntegration = (integrationId, payload) => apiClient.patch(`/integrations/${integrationId}`, payload)
const runIntegration = (integrationId) => apiClient.post(`/integrations/${integrationId}/run`)
const triggerIntegration = (integrationId, payload) => apiClient.post(`/integrations/${integrationId}/trigger`, payload)

export default {
  listIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  runIntegration,
  triggerIntegration,
}
