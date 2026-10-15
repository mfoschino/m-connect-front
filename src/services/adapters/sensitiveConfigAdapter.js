const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const hasValue = (value) => String(value ?? '').trim().length > 0

const CONFIGURED_MARKER = '[configurado]'
const NOT_CONFIGURED_MARKER = '[no configurado]'

const SENSITIVE_CONFIG_KEY_SUFFIXES = [
  'accesstoken',
  'apikey',
  'authentication',
  'authorization',
  'bearer',
  'clientsecret',
  'cookie',
  'credential',
  'credentials',
  'passwd',
  'password',
  'passwordconfirmation',
  'passwordhash',
  'privatekey',
  'privatekeypem',
  'refreshtoken',
  'secret',
  'secretvalue',
  'token',
  'tokenvalue',
]

const SENSITIVE_CONFIG_KEY_TOKENS = new Set([
  'auth',
  'authentication',
  'authorization',
  'bearer',
  'cookie',
  'credential',
  'credentials',
  'passwd',
  'password',
  'secret',
  'token',
])

const SAFE_DESCRIPTOR_KEY_TOKENS = new Set([
  'algorithm',
  'disable',
  'disabled',
  'description',
  'domain',
  'email',
  'enable',
  'enabled',
  'endpoint',
  'expiration',
  'expires',
  'expiry',
  'file',
  'format',
  'has',
  'help',
  'header',
  'headers',
  'id',
  'label',
  'method',
  'mode',
  'name',
  'path',
  'policy',
  'required',
  'requires',
  'rotation',
  'scheme',
  'scope',
  'status',
  'supports',
  'ttl',
  'type',
  'url',
  'use',
  'uses',
  'version',
])

const SAFE_HEADER_KEYS = new Set([
  'accept',
  'acceptencoding',
  'acceptlanguage',
  'cachecontrol',
  'contenttype',
  'useragent',
])

const CREDENTIAL_VALUE_PATTERN = /^\s*(?:(?:bearer|token)\s+\S+|basic\s+[a-z\d+/_-]{8,}={0,2})\s*$/i
const EXPLICIT_SENSITIVE_FIELD_TYPES = new Set(['password', 'secret', 'sensitive'])
const SENSITIVE_URL_QUERY_KEYS = new Set([
  'oauthsignature',
  'sig',
  'signature',
  'xamzsignature',
  'xgoogsignature',
])
const HEADER_CONTAINER_KEY_TOKENS = new Set([
  'collection',
  'config',
  'configuration',
  'list',
  'map',
  'values',
])

const normalizeConfigKey = (key) => String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

const getConfigKeyTokens = (key) => String(key ?? '')
  .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .replace(/([a-z\d])([A-Z])/g, '$1 $2')
  .toLowerCase()
  .split(/[^a-z\d]+/)
  .filter(Boolean)

const hasTokenPair = (tokens, first, second) => (
  tokens.includes(first) && tokens.includes(second)
)

/**
 * Sensitive values are detected after normalizing snake/camel/kebab case.
 * Credential concepts are matched as snake/camel/kebab words, plus established
 * compact spellings. Descriptor words keep metadata such as token_endpoint,
 * credential_status and api_key_header visible without allowlisting connectors.
 */
export const isSensitiveConfigKey = (key) => {
  const normalizedKey = normalizeConfigKey(key)
  if (!normalizedKey) return false

  const tokens = getConfigKeyTokens(key)
  const isDescriptor = tokens.some((token) => SAFE_DESCRIPTOR_KEY_TOKENS.has(token))
  if (isDescriptor) return false

  const hasSensitiveToken = tokens.some((token) => SENSITIVE_CONFIG_KEY_TOKENS.has(token))
  const hasSensitivePair = (
    hasTokenPair(tokens, 'access', 'token')
    || hasTokenPair(tokens, 'api', 'key')
    || hasTokenPair(tokens, 'client', 'secret')
    || hasTokenPair(tokens, 'private', 'key')
    || hasTokenPair(tokens, 'refresh', 'token')
    || hasTokenPair(tokens, 'webhook', 'secret')
  )

  if (hasSensitiveToken || hasSensitivePair) return true

  return SENSITIVE_CONFIG_KEY_SUFFIXES.some((suffix) => (
    normalizedKey === suffix || normalizedKey.endsWith(suffix)
  ))
}

const isHeadersContainerKey = (key) => {
  const normalizedKey = normalizeConfigKey(key)
  const tokens = getConfigKeyTokens(key)
  const hasHeaderToken = tokens.includes('header') || tokens.includes('headers')

  return normalizedKey === 'headers'
    || normalizedKey.endsWith('headers')
    || (hasHeaderToken && tokens.some((token) => HEADER_CONTAINER_KEY_TOKENS.has(token)))
}
const isHeaderDescriptorKey = (key) => normalizeConfigKey(key).includes('header')

const isSensitiveUrlQueryKey = (key) => {
  const normalizedKey = normalizeConfigKey(key)
  return isSensitiveConfigKey(key)
    || SENSITIVE_URL_QUERY_KEYS.has(normalizedKey)
    || normalizedKey.endsWith('signature')
}

export const isSensitiveConfigField = (field) => {
  if (typeof field === 'string') return isSensitiveConfigKey(field)
  if (!isObject(field)) return false

  if (
    field.sensitive === true
    || field.is_sensitive === true
    || field.secret === true
    || field.writeOnly === true
    || field.write_only === true
  ) {
    return true
  }

  const declaredTypes = [field.type, field.input_type, field.inputType, field.format]
  if (declaredTypes.some((type) => EXPLICIT_SENSITIVE_FIELD_TYPES.has(normalizeConfigKey(type)))) {
    return true
  }

  const fieldKey = field.id ?? field.name ?? field.key
  if (normalizeConfigKey(field.type) === 'json' && isHeadersContainerKey(fieldKey)) {
    return true
  }

  return isSensitiveConfigKey(fieldKey)
}

const getRedactionMarker = (value) => (
  hasValue(value) ? CONFIGURED_MARKER : NOT_CONFIGURED_MARKER
)

const redactSensitiveUrlParts = (value) => {
  if (typeof value !== 'string') return value

  return value
    .replace(
      /((?:[a-z][a-z\d+.-]*:)?\/\/)([^/?#@\s]+)@/gi,
      `$1${CONFIGURED_MARKER}@`,
    )
    .replace(/([?&#])([^=&#]+)=([^&#]*)/g, (match, separator, rawKey, rawValue) => {
      let decodedKey = rawKey
      try {
        decodedKey = decodeURIComponent(rawKey)
      } catch {
        // Keep malformed names unchanged; their value remains subject to key checks.
      }

      return isSensitiveUrlQueryKey(decodedKey)
        ? `${separator}${rawKey}=${getRedactionMarker(rawValue)}`
        : match
    })
}

const redactConfigValue = (value, insideHeaders = false) => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactConfigValue(entry, insideHeaders))
  }

  if (!isObject(value)) {
    if (insideHeaders) return getRedactionMarker(value)
    return redactSensitiveUrlParts(value)
  }

  return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [
    key,
    isSensitiveConfigKey(key)
      ? getRedactionMarker(entryValue)
      : insideHeaders && !SAFE_HEADER_KEYS.has(normalizeConfigKey(key))
        ? getRedactionMarker(entryValue)
        : typeof entryValue === 'string'
          && (insideHeaders || isHeaderDescriptorKey(key))
          && CREDENTIAL_VALUE_PATTERN.test(entryValue)
          ? getRedactionMarker(entryValue)
          : redactConfigValue(entryValue, isHeadersContainerKey(key)),
  ]))
}

/**
 * Creates a redacted copy for presentation or diagnostic logging only.
 * Never use its result as an IntegrationConfig API payload.
 */
export const redactSensitiveConfig = (value) => redactConfigValue(value)
