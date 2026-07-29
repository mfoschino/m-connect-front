import apiClient from './client'
import {
  buildBackendProfilePayload,
  mapBackendProfileToForm,
  normalizeProfileList,
} from '../adapters/profileAdapter'

const mapResponseData = (response, mapper) => ({
  ...response,
  data: mapper(response.data),
})

const listProfiles = async () => {
  const response = await apiClient.get('/profiles')
  return mapResponseData(response, normalizeProfileList)
}

const getProfile = async (profileId) => {
  const response = await apiClient.get(`/profiles/${profileId}`)
  return mapResponseData(response, mapBackendProfileToForm)
}

const createProfile = async (formData) => {
  const response = await apiClient.post('/profiles', buildBackendProfilePayload(formData))
  return mapResponseData(response, mapBackendProfileToForm)
}

const updateProfile = async (profileId, formData) => {
  const response = await apiClient.patch(`/profiles/${profileId}`, buildBackendProfilePayload(formData))
  return mapResponseData(response, mapBackendProfileToForm)
}

export default {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
}
