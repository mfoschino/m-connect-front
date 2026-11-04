const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasText = (value) => typeof value === 'string' && value.trim().length > 0

const requireIdentity = (value) => {
  if (!isObject(value) || !hasText(value.id) || !hasText(value.name)) {
    throw new Error('La respuesta de conectores no tiene el formato esperado.')
  }
}

// Allowlist de presentación: config, secrets y formularios nunca pasan al estado de la UI.
const pick = (value, keys) => Object.fromEntries(keys
  .filter((key) => Object.hasOwn(value, key))
  .map((key) => [key, value[key]]))

const stringFields = (value, keys) => {
  const result = pick(value, keys)
  if (Object.values(result).some((entry) => entry !== null && typeof entry !== 'string')) {
    throw new Error('La respuesta de conectores no tiene el formato esperado.')
  }
  return result
}

const activeField = (value) => {
  if (!Object.hasOwn(value, 'is_active')) return {}
  if (typeof value.is_active !== 'boolean') throw new Error('Estado de conector inválido.')
  return { is_active: value.is_active }
}

export const normalizeConnectorDefinition = (value) => {
  requireIdentity(value)
  const result = {
    ...stringFields(value, ['id', 'owner_tenant_id', 'visibility', 'code', 'name',
      'driver', 'kind', 'description', 'created_at', 'updated_at']),
    ...activeField(value),
  }
  if (Object.hasOwn(value, 'active_version')) {
    if (value.active_version === null) result.active_version = null
    else {
      const version = value.active_version
      if (!isObject(version) || !hasText(version.id) || !hasText(version.version)) {
        throw new Error('Versión de conector inválida.')
      }
      result.active_version = pick(version, ['id', 'version'])
    }
  }
  return result
}

export const normalizeConnectorInstallation = (value) => {
  requireIdentity(value)
  requireIdentity(value.connector)
  if (!hasText(value.tenant_id)) throw new Error('La instalación no identifica su organización.')
  const result = {
    ...stringFields(value, ['id', 'tenant_id', 'definition_version_id', 'version',
      'name', 'created_at', 'updated_at']),
    connector: stringFields(value.connector, ['id', 'code', 'name', 'kind', 'driver']),
    ...activeField(value),
  }
  if (Object.hasOwn(value, 'secret_fields')) {
    if (!Array.isArray(value.secret_fields) || !value.secret_fields.every(hasText)) {
      throw new Error('Estado de credenciales inválido.')
    }
    result.secret_fields = [...value.secret_fields]
  }
  return result
}

const normalizeList = (value, normalize) => {
  if (!Array.isArray(value)) throw new Error('Se esperaba una lista de conectores.')
  const items = value.map(normalize)
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('La lista contiene identificadores repetidos.')
  }
  return items
}

export const normalizeConnectorDefinitions = (value) => normalizeList(value, normalizeConnectorDefinition)
export const normalizeConnectorInstallations = (value) => normalizeList(value, normalizeConnectorInstallation)

export const connectorAvailability = (definition) => {
  if (definition.is_active === false) return 'inactive'
  if (definition.active_version === null) return 'unpublished'
  if (definition.is_active === true && definition.active_version?.id) return 'available'
  return 'unknown'
}

const includesSearch = (values, search) => {
  const term = search.trim().toLocaleLowerCase('es')
  return values.some((value) => String(value ?? '').toLocaleLowerCase('es').includes(term))
}

export const filterConnectorInstallations = (items, { search = '', kind = '', status = '', definitionId = '' } = {}) => (
  items.filter((item) => includesSearch([item.name, item.connector.name], search)
    && (!kind || item.connector.kind === kind)
    && (!definitionId || item.connector.id === definitionId)
    && (!status || (status === 'active' ? item.is_active === true : item.is_active === false)))
)

export const filterConnectorDefinitions = (items, { search = '', kind = '', availability = '' } = {}) => (
  items.filter((item) => includesSearch([item.name, item.description], search)
    && (!kind || item.kind === kind)
    && (!availability || connectorAvailability(item) === availability))
)
