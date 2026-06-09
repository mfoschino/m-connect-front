import apiClient from './client'

const listProfiles = () => apiClient.get('/profiles')
const getProfile = (profileId) => apiClient.get(`/profiles/${profileId}`)
const createProfile = (payload) => apiClient.post('/profiles', payload)
const updateProfile = (profileId, payload) => apiClient.patch(`/profiles/${profileId}`, payload)

export default {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
}
