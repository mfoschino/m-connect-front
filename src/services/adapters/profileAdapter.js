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

export const getProfileDisplayName = (profile = {}) => {
  const sourceSystem = String(profile.source_system ?? '').trim() || 'Sistema sin definir'
  const entity = String(profile.entity ?? profile.source_entity ?? '').trim() || 'Entidad sin definir'
  const version = String(profile.version ?? '').trim() || 'Sin versión'

  return `${sourceSystem} · ${entity} · ${version}`
}

export const getResetProfileMappings = (config) => (
  structuredClone(config ?? [])
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

export const buildBackendProfileCreatePayload = (formData = {}) => ({
  source_system: formData.source_system,
  entity: formData.entity ?? formData.source_entity,
  version: formData.version,
  config: normalizeBackendMappingList(formData.config ?? []),
  is_active: formData.is_active ?? formData.active ?? true,
})

export const buildBackendProfileUpdatePayload = (formData = {}) => ({
  config: normalizeBackendMappingList(formData.config ?? []),
  version: formData.version,
  is_active: formData.is_active ?? formData.active ?? true,
})

// Backwards-compatible alias for callers that still build create payloads.
export const buildBackendProfilePayload = buildBackendProfileCreatePayload

export const normalizeProfileList = (profiles) => (
  Array.isArray(profiles) ? profiles.map(mapBackendProfileToForm) : []
)
