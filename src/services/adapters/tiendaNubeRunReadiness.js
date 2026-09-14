export const TIENDA_NUBE_STATUS_LOOKUP = 'TiendaNubeStatusMap'

export const FINNEGANS_DOCUMENTS = {
  pedido_venta: {
    label: 'Pedido de Venta',
    sourceSystem: 'finnegans',
  },
  punto_venta: {
    label: 'Punto de Venta',
    sourceSystem: 'finnegans_punto_venta',
  },
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const hasValue = (value) => String(value ?? '').trim().length > 0
const isActiveProfile = (profile) => (profile?.is_active ?? profile?.active) === true
const getProfileEntity = (profile) => profile?.entity ?? profile?.source_entity

export const isTiendaNubeSalesOrderIntegration = (integration) => (
  isObject(integration)
  && isObject(integration.config)
  && integration.connector_type === 'api'
  && integration.source_entity === 'sales_order'
  && integration.config.source_system === 'tiendanube'
)

export const getFinnegansDocument = (integration) => {
  if (!isObject(integration) || !isObject(integration.config)) return null

  const document = integration.config.finnegans_document
  return FINNEGANS_DOCUMENTS[document] ? document : null
}

const getActiveProfiles = (profiles, sourceSystem) => profiles.filter((profile) => (
  profile?.source_system === sourceSystem
  && getProfileEntity(profile) === 'sales_order'
  && isActiveProfile(profile)
))

const referencesLookupTable = (value, lookupTableName) => {
  if (Array.isArray(value)) {
    return value.some((entry) => referencesLookupTable(entry, lookupTableName))
  }

  if (!isObject(value)) return false
  const lookupTableCode = value.lookup_table_code ?? value.lookup_table_name
  if (lookupTableCode === lookupTableName) return true

  return Object.values(value).some((entry) => referencesLookupTable(entry, lookupTableName))
}

export const getTiendaNubeRunReadiness = (options = {}) => {
  const safeOptions = isObject(options) ? options : {}
  const integration = isObject(safeOptions.integration) ? safeOptions.integration : {}
  const lookupTables = Array.isArray(safeOptions.lookupTables) ? safeOptions.lookupTables : []
  const profiles = Array.isArray(safeOptions.profiles) ? safeOptions.profiles : []
  const credentialsStatus = isObject(safeOptions.credentialsStatus)
    ? safeOptions.credentialsStatus
    : {}
  const credentialsLoading = safeOptions.credentialsLoading === true
  const credentialsError = safeOptions.credentialsError || ''
  const config = isObject(integration.config) ? integration.config : {}
  const document = getFinnegansDocument(integration)
  const documentDefinition = document ? FINNEGANS_DOCUMENTS[document] : null
  const inboundProfiles = getActiveProfiles(profiles, 'tiendanube')
  const outboundProfiles = documentDefinition
    ? getActiveProfiles(profiles, documentDefinition.sourceSystem)
    : []
  const requiresStatusLookup = inboundProfiles.some((profile) => referencesLookupTable(
    profile.config,
    TIENDA_NUBE_STATUS_LOOKUP,
  ))
  const hasRequiredStatusLookup = lookupTables.some(
    (lookup) => lookup?.codigo === TIENDA_NUBE_STATUS_LOOKUP,
  )

  const checks = [
    {
      id: 'integration',
      label: 'Integración activa de pedidos de venta de Tienda Nube',
      ready: isTiendaNubeSalesOrderIntegration(integration) && integration.is_active === true,
      blocking: true,
      action: 'integration',
    },
    {
      id: 'base_url',
      label: 'URL base configurada',
      ready: hasValue(config.base_url),
      blocking: true,
      action: 'integration',
    },
    {
      id: 'endpoint',
      label: 'Ruta de la API configurada',
      ready: hasValue(config.endpoint),
      blocking: true,
      action: 'integration',
    },
    {
      id: 'authentication',
      label: 'Autenticación de Tienda Nube configurada',
      ready: hasValue(config.auth_type)
        && hasValue(config.api_key_header)
        && hasValue(config.api_key),
      blocking: true,
      action: 'integration',
    },
    {
      id: 'headers',
      label: 'Encabezados guardados como objeto',
      ready: isObject(config.headers),
      blocking: true,
      action: 'integration',
    },
    {
      id: 'pagination',
      label: 'Paginación guardada como objeto',
      ready: isObject(config.pagination),
      blocking: true,
      action: 'integration',
    },
    {
      id: 'finnegans_document',
      label: 'Documento Finnegans seleccionado',
      ready: Boolean(documentDefinition),
      blocking: true,
      action: 'integration',
    },
    {
      id: 'lookup',
      label: requiresStatusLookup
        ? `Tabla de consulta ${TIENDA_NUBE_STATUS_LOOKUP}`
        : `${TIENDA_NUBE_STATUS_LOOKUP} no es necesaria para el perfil de entrada`,
      ready: !requiresStatusLookup || hasRequiredStatusLookup,
      blocking: requiresStatusLookup,
      action: 'lookup',
    },
    {
      id: 'inbound_profile',
      label: 'Perfil de entrada activo para Tienda Nube y pedidos de venta',
      ready: inboundProfiles.length > 0,
      blocking: true,
      action: 'profile',
    },
    {
      id: 'outbound_profile',
      label: documentDefinition
        ? `Perfil de salida activo para ${documentDefinition.label}`
        : 'Perfil de salida correspondiente activo',
      ready: outboundProfiles.length > 0,
      blocking: true,
      action: 'profile',
    },
    {
      id: 'credentials',
      label: credentialsLoading
        ? 'Consultando credenciales Finnegans'
        : credentialsError
          ? 'No se pudo verificar las credenciales Finnegans'
          : 'Credenciales Finnegans configuradas',
      ready: !credentialsLoading
        && !credentialsError
        && credentialsStatus.has_credentials === true,
      blocking: true,
      action: 'credentials',
    },
  ]

  const missingChecks = checks.filter((check) => !check.ready)

  return {
    checks,
    missingChecks,
    document,
    documentLabel: documentDefinition?.label ?? 'No seleccionado',
    outboundSourceSystem: documentDefinition?.sourceSystem ?? null,
    canRun: missingChecks.every((check) => !check.blocking),
    fullyReady: missingChecks.length === 0,
  }
}

const SAFE_CONFIG_DESCRIPTOR_KEYS = new Set([
  'apikeyheader',
  'authtype',
  'authenticationtype',
  'authorizationtype',
  'tokentype',
])

const SENSITIVE_CONFIG_KEY_MARKERS = [
  'accesstoken',
  'apikey',
  'authentication',
  'authorization',
  'bearer',
  'cookie',
  'credential',
  'password',
  'privatekey',
  'secret',
  'token',
]

const SAFE_HEADER_KEYS = new Set([
  'accept',
  'acceptencoding',
  'acceptlanguage',
  'cachecontrol',
  'contenttype',
  'useragent',
])

const CONFIGURED_MARKER = '[configurado]'
const NOT_CONFIGURED_MARKER = '[no configurado]'
const CREDENTIAL_VALUE_PATTERN = /^\s*(?:api[ -]?key|basic|bearer|token)\s+/i

const normalizeConfigKey = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '')

const isSensitiveConfigKey = (key) => {
  const normalizedKey = normalizeConfigKey(key)

  if (SAFE_CONFIG_DESCRIPTOR_KEYS.has(normalizedKey)) return false
  if (normalizedKey === 'auth') return true

  return SENSITIVE_CONFIG_KEY_MARKERS.some((marker) => normalizedKey.includes(marker))
}

const getRedactionMarker = (value) => (
  hasValue(value) ? CONFIGURED_MARKER : NOT_CONFIGURED_MARKER
)

const redactSensitiveUrlParts = (value) => {
  if (typeof value !== 'string') return value

  return value
    .replace(
      /([a-z][a-z\d+.-]*:\/\/)([^/?#@\s]+)@/gi,
      `$1${CONFIGURED_MARKER}@`,
    )
    .replace(/([?&#])([^=&#]+)=([^&#]*)/g, (match, separator, rawKey, rawValue) => {
      let decodedKey = rawKey
      try {
        decodedKey = decodeURIComponent(rawKey)
      } catch {
        // Keep the raw key when malformed percent-encoding prevents decoding.
      }

      return isSensitiveConfigKey(decodedKey)
        ? `${separator}${rawKey}=${getRedactionMarker(rawValue)}`
        : match
    })
}

const redactConfigValue = (value, insideHeaders = false) => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactConfigValue(entry, insideHeaders))
  }
  if (!isObject(value)) {
    return CREDENTIAL_VALUE_PATTERN.test(String(value ?? ''))
      ? getRedactionMarker(value)
      : redactSensitiveUrlParts(value)
  }

  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [
    key,
    isSensitiveConfigKey(key)
      ? getRedactionMarker(entryValue)
      : insideHeaders && !SAFE_HEADER_KEYS.has(normalizeConfigKey(key))
        ? getRedactionMarker(entryValue)
        : redactConfigValue(entryValue, normalizeConfigKey(key) === 'headers'),
  ]))
}

export const redactSensitiveConfig = (value) => redactConfigValue(value)
