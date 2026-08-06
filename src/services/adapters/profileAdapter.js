import {
  mapBackendMappingListToForm,
  normalizeBackendMappingList,
} from './mappingAdapter.js'
import { isFinnegansSourceSystem } from './integrationFlowAdapter.js'

export const getProfileFlowRole = (profile = {}) => (
  isFinnegansSourceSystem(profile.source_system)
    ? 'outbound'
    : 'inbound'
)

export const mapBackendProfileToForm = (profile) => {
  const backendProfile = profile ?? {}

  return {
    ...backendProfile,
    source_entity: backendProfile.entity ?? backendProfile.source_entity ?? '',
    active: backendProfile.is_active ?? backendProfile.active ?? true,
    config: mapBackendMappingListToForm(backendProfile.config ?? []),
  }
}

export const buildBackendProfilePayload = (formData = {}) => ({
  source_system: formData.source_system,
  entity: formData.entity ?? formData.source_entity,
  version: formData.version,
  config: normalizeBackendMappingList(formData.config ?? []),
  is_active: formData.is_active ?? formData.active ?? true,
})

export const normalizeProfileList = (profiles) => (
  Array.isArray(profiles) ? profiles.map(mapBackendProfileToForm) : []
)
