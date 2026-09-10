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

const SENSITIVE_CONFIG_KEYS = new Set([
  'api_key',
  'apikey',
  'access_token',
  'accesstoken',
  'bearer_token',
  'bearertoken',
  'authentication',
  'authorization',
  'client_secret',
  'clientsecret',
  'password',
  'secret',
  'token',
  'x_api_key',
])

export const redactSensitiveConfig = (value) => {
  if (Array.isArray(value)) return value.map(redactSensitiveConfig)
  if (!isObject(value)) return value

  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [
    key,
    SENSITIVE_CONFIG_KEYS.has(key.toLowerCase().replaceAll('-', '_'))
      ? (hasValue(entryValue) ? '[configurado]' : '[no configurado]')
      : redactSensitiveConfig(entryValue),
  ]))
}
