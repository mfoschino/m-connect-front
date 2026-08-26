import {
  mapBackendMappingListToForm,
  normalizeBackendMappingList,
} from './mappingAdapter.js'

export const FINNEGANS_SOURCE_SYSTEM = 'finnegans'
export const FINNEGANS_PUNTO_VENTA_SOURCE_SYSTEM = 'finnegans_punto_venta'
export const FINNEGANS_DOCUMENT_PEDIDO_VENTA = 'pedido_venta'
export const FINNEGANS_DOCUMENT_PUNTO_VENTA = 'punto_venta'
export const FINNEGANS_DOCUMENT_ENTITY = 'sales_order'

const LEGACY_API_CONFIG_KEYS = {
  baseUrl: 'base_url',
  authType: 'auth_type',
  apiKeyHeader: 'api_key_header',
  apiKey: 'api_key',
  bearerToken: 'bearer_token',
  basicUsername: 'basic_username',
  basicPassword: 'basic_password',
  dataPath: 'data_path',
}

const isObjectConfig = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
)

const parseObjectConfig = (value) => {
  if (isObjectConfig(value) || typeof value !== 'string' || !value.trim()) return value

  try {
    const parsedValue = JSON.parse(value)
    return isObjectConfig(parsedValue) ? parsedValue : value
  } catch {
    return value
  }
}

export const normalizeApiConnectorConfig = (config = {}) => {
  const normalizedConfig = { ...config }

  Object.entries(LEGACY_API_CONFIG_KEYS).forEach(([legacyKey, backendKey]) => {
    if (normalizedConfig[backendKey] === undefined && normalizedConfig[legacyKey] !== undefined) {
      normalizedConfig[backendKey] = normalizedConfig[legacyKey]
    }
    delete normalizedConfig[legacyKey]
  })

  if (Object.hasOwn(normalizedConfig, 'headers')) {
    normalizedConfig.headers = parseObjectConfig(normalizedConfig.headers)
  }
  if (Object.hasOwn(normalizedConfig, 'pagination')) {
    normalizedConfig.pagination = parseObjectConfig(normalizedConfig.pagination)
  }

  if (normalizedConfig.data_path === '') {
    normalizedConfig.data_path = null
  }

  return normalizedConfig
}

const normalizeConnectorConfig = (config, connectorType) => (
  connectorType === 'api' ? normalizeApiConnectorConfig(config) : { ...(config ?? {}) }
)

export const FINNEGANS_DOCUMENT_OPTIONS = [
  {
    value: FINNEGANS_DOCUMENT_PEDIDO_VENTA,
    label: 'Pedido de venta',
    description: 'Envía el documento al circuito de pedidos de venta de Finnegans.',
  },
  {
    value: FINNEGANS_DOCUMENT_PUNTO_VENTA,
    label: 'Punto de venta',
    description: 'Envía el documento al circuito de punto de venta de Finnegans.',
  },
]

const OUTBOUND_SOURCE_SYSTEM_BY_DOCUMENT = {
  [FINNEGANS_DOCUMENT_PEDIDO_VENTA]: FINNEGANS_SOURCE_SYSTEM,
  [FINNEGANS_DOCUMENT_PUNTO_VENTA]: FINNEGANS_PUNTO_VENTA_SOURCE_SYSTEM,
}

const FINNEGANS_SOURCE_SYSTEMS = new Set(Object.values(OUTBOUND_SOURCE_SYSTEM_BY_DOCUMENT))
const VALID_FINNEGANS_DOCUMENTS = new Set(Object.keys(OUTBOUND_SOURCE_SYSTEM_BY_DOCUMENT))

const humanizeEntity = (entity) => String(entity ?? '')
  .split('_')
  .filter(Boolean)
  .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ')

export const getIntegrationSourceSystem = (integration = {}) => (
  integration.config?.source_system
  ?? integration.source_system
  ?? integration.source_system_id
  ?? ''
)

const getFormSourceSystem = (formData = {}) => (
  formData.source_system
  || formData.source_system_id
  || formData.config?.source_system
  || ''
)

export const getFinnegansDocument = (integration = {}) => (
  integration.finnegans_document
  ?? integration.config?.finnegans_document
  ?? ''
)

export const isFinnegansDocumentConfigurable = (entity) => (
  String(entity ?? '').trim() === FINNEGANS_DOCUMENT_ENTITY
)

export const getDefaultFinnegansDocument = (entity) => (
  isFinnegansDocumentConfigurable(entity) ? FINNEGANS_DOCUMENT_PEDIDO_VENTA : ''
)

export const normalizeFinnegansDocumentForEntity = (entity, config = {}) => {
  if (!isFinnegansDocumentConfigurable(entity)) return ''

  const finnegansDocument = typeof config === 'string'
    ? config
    : getFinnegansDocument(config)

  return VALID_FINNEGANS_DOCUMENTS.has(finnegansDocument)
    ? finnegansDocument
    : getDefaultFinnegansDocument(entity)
}

export const getOutboundSourceSystemForFinnegansDocument = (finnegansDocument) => (
  OUTBOUND_SOURCE_SYSTEM_BY_DOCUMENT[finnegansDocument] ?? ''
)

export const getOutboundProfileSourceSystem = (finnegansDocument, entity) => (
  getOutboundSourceSystemForFinnegansDocument(finnegansDocument)
  || (isFinnegansDocumentConfigurable(entity) ? '' : FINNEGANS_SOURCE_SYSTEM)
)

export const getActiveCompatibleProfiles = (profiles, sourceSystem, entity) => (
  Array.isArray(profiles)
    ? profiles.filter((profile) => (
        profile?.source_system === sourceSystem
        && (profile.entity ?? profile.source_entity ?? '') === entity
        && (profile.is_active ?? profile.active) === true
      ))
    : []
)

export const isFinnegansSourceSystem = (sourceSystem) => (
  FINNEGANS_SOURCE_SYSTEMS.has(String(sourceSystem ?? '').trim().toLowerCase())
  || String(sourceSystem ?? '').trim().toLowerCase().startsWith('finnegans')
)

export const getCanonicalEntityDesign = (entity, entityTypes = []) => {
  const entityOption = entityTypes.find((option) => option.value === entity)
  const entityLabel = entityOption?.label ?? humanizeEntity(entity) ?? entity

  return {
    value: entity ?? '',
    label: entityLabel ? `${entityLabel} canónico M-Connect` : 'Formato canónico M-Connect',
    description: entityOption?.description,
  }
}

export const mapBackendIntegrationToDesign = (integration) => {
  const backendIntegration = integration ?? {}
  const backendConfig = normalizeConnectorConfig(
    backendIntegration.config,
    backendIntegration.connector_type,
  )
  const sourceEntity = backendIntegration.source_entity ?? backendIntegration.entity ?? ''
  const config = {
    ...backendConfig,
    field_mappings: mapBackendMappingListToForm(backendConfig.field_mappings ?? []),
  }

  return {
    ...backendIntegration,
    source_entity: sourceEntity,
    source_system_id: getIntegrationSourceSystem(backendIntegration),
    finnegans_document: normalizeFinnegansDocumentForEntity(sourceEntity, backendIntegration),
    config,
    schedule: backendIntegration.schedule ?? null,
  }
}

export const buildBackendIntegrationPayload = (formData = {}) => {
  const config = normalizeConnectorConfig(formData.config, formData.connector_type)
  const sourceEntity = formData.source_entity ?? formData.entity_id
  const sourceSystem = getFormSourceSystem(formData)
  const finnegansDocument = normalizeFinnegansDocumentForEntity(sourceEntity, formData)

  for (const profileField of [
    'profile_id',
    'inbound_profile_id',
    'outbound_profile_id',
    'profiles',
    'suggested_profiles',
  ]) {
    delete config[profileField]
  }

  if (sourceSystem) {
    config.source_system = sourceSystem
  }

  if (isFinnegansDocumentConfigurable(sourceEntity) && finnegansDocument) {
    config.finnegans_document = finnegansDocument
  } else {
    delete config.finnegans_document
  }

  if (Array.isArray(formData.field_mappings)) {
    config.field_mappings = normalizeBackendMappingList(formData.field_mappings)
  }

  return {
    name: formData.name?.trim(),
    source_entity: sourceEntity,
    connector_type: formData.connector_type,
    config,
    schedule: formData.schedule ?? null,
    is_active: formData.is_active ?? true,
  }
}
