import apiClient from './client'

const listLookupTables = () => apiClient.get('/lookup-tables')
const getLookupTable = (lookupId) => apiClient.get(`/lookup-tables/${lookupId}`)
const createLookupTable = (payload) => apiClient.post('/lookup-tables', payload)
const updateLookupTable = (lookupId, payload) => apiClient.patch(`/lookup-tables/${lookupId}`, payload)
const deleteLookupTable = (lookupId) => apiClient.delete(`/lookup-tables/${lookupId}`)

export default {
  listLookupTables,
  getLookupTable,
  createLookupTable,
  updateLookupTable,
  deleteLookupTable,
}
