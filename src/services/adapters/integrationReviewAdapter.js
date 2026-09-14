import { redactSensitiveConfig } from './tiendaNubeRunReadiness.js'

const isObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
)

const REVIEW_EXCLUDED_CONFIG_KEYS = new Set([
  'field_mappings',
  'finnegans_document',
  'inbound_profile_id',
  'outbound_profile_id',
  'profile_candidates',
  'profile_id',
  'profiles',
  'review_state',
  'sanitized_config',
  'source_system',
  'suggested_profiles',
])

export const getSafeIntegrationReviewConfig = (config) => {
  if (!isObject(config)) return {}

  const sourceConfig = Object.fromEntries(
    Object.entries(config).filter(
      ([key]) => !REVIEW_EXCLUDED_CONFIG_KEYS.has(key.toLowerCase()),
    ),
  )

  return redactSensitiveConfig(sourceConfig)
}
