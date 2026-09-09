const DEFAULT_COLLECTION_KEYS = ['items', 'values', 'data', 'results', 'types', 'strategies']

const METADATA_LABELS = {
  simple: 'Simple',
  constant: 'Constante',
  path: 'Ruta',
  default: 'Valor predeterminado',
  lookup: 'Consulta',
  datetime: 'Fecha y hora',
  expression: 'Expresión',
  table: 'Tabla',
  nested_object: 'Objeto anidado',
  string: 'Texto',
  fail: 'Detener con error',
  skip: 'Omitir',
  retry: 'Reintentar',
  sales_order: 'Pedido de venta',
  customer: 'Cliente',
  product: 'Producto',
  invoice: 'Factura',
  inventory: 'Inventario',
  payment: 'Pago',
  user: 'Usuario',
  contact: 'Contacto',
  api: 'API',
  db: 'Base de datos',
  database: 'Base de datos',
  file: 'Archivo',
  webhook: 'Webhook',
}

const CONFIG_FIELD_LABELS = {
  default_value: 'Valor predeterminado',
  lookup_table_code: 'Tabla de consulta',
  lookup_table_name: 'Tabla de consulta',
  source_format: 'Formato de origen',
  target_format: 'Formato de destino',
  expression: 'Expresión',
  sub_mappings: 'Mapeos anidados',
  path: 'Ruta',
  value: 'Valor',
}

const humanize = (value) => String(value)
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase())

const objectToItems = (value) => Object.entries(value).map(([key, details]) => {
  if (typeof details === 'string') {
    return { value: key, label: details }
  }

  return { value: key, ...(details ?? {}) }
})

const extractItems = (payload, collectionKeys) => {
  if (Array.isArray(payload)) return payload

  if (!payload || typeof payload !== 'object') return null

  if (['value', 'code', 'id', 'key', 'type', 'name'].some((key) => key in payload)) {
    return [payload]
  }

  for (const key of [...collectionKeys, ...DEFAULT_COLLECTION_KEYS]) {
    const collection = payload[key]
    if (Array.isArray(collection)) return collection
    if (collection && typeof collection === 'object') return objectToItems(collection)
  }

  return objectToItems(payload)
}

const normalizeItem = (item) => {
  if (typeof item === 'string' || typeof item === 'number') {
    const value = String(item)
    return { value, label: METADATA_LABELS[value] ?? humanize(value) }
  }

  if (!item || typeof item !== 'object') return null

  const rawValue = item.value ?? item.code ?? item.id ?? item.key ?? item.type ?? item.name
  if (rawValue === undefined || rawValue === null || rawValue === '') return null

  const value = String(rawValue)
  const label = String(METADATA_LABELS[value] ?? item.label ?? item.display_name ?? item.name ?? humanize(value))
  const description = item.description ?? item.help_text ?? item.help

  return description
    ? { value, label, description: String(description) }
    : { value, label }
}

export const normalizeMetadataOptions = (payload, collectionKeys, metadataName) => {
  const items = extractItems(payload, collectionKeys)

  if (!items) {
    throw new Error(`La respuesta de ${metadataName} no tiene una estructura reconocida.`)
  }

  const seen = new Set()
  const options = items
    .map(normalizeItem)
    .filter((option) => {
      if (!option || seen.has(option.value)) return false
      seen.add(option.value)
      return true
    })

  if (options.length === 0) {
    throw new Error(`${metadataName} no devolvió opciones disponibles.`)
  }

  return options
}

const normalizeConfigField = (field) => {
  if (typeof field === 'string') {
    return {
      name: field,
      label: humanize(field),
      type: 'string',
      required: false,
    }
  }

  if (!field || typeof field !== 'object') return null

  const rawName = field.name ?? field.key ?? field.id
  if (!rawName) return null

  const name = String(rawName)
  const description = field.description ?? field.help_text ?? field.help

  return {
    name,
    label: String(CONFIG_FIELD_LABELS[name] ?? field.label ?? field.display_name ?? humanize(name)),
    type: String(field.type ?? 'string'),
    required: field.required === true,
    ...(description ? { description: String(description) } : {}),
  }
}

export const normalizeConfigFields = (fields) => {
  if (!Array.isArray(fields)) return []

  const seen = new Set()
  return fields
    .map(normalizeConfigField)
    .filter((field) => {
      if (!field || seen.has(field.name)) return false
      seen.add(field.name)
      return true
    })
}

export const normalizeFieldTypesCatalog = (payload) => {
  const fieldTypes = normalizeMetadataOptions(
    payload,
    ['field_types', 'fieldTypes'],
    'Los tipos de campo',
  )
  const rawFieldTypes = extractItems(payload, ['field_types', 'fieldTypes']) ?? []
  const fieldTypeConfigFields = {}

  rawFieldTypes.forEach((fieldType) => {
    if (!fieldType || typeof fieldType !== 'object') return

    const value = fieldType.value
      ?? fieldType.code
      ?? fieldType.id
      ?? fieldType.key
      ?? fieldType.type
      ?? fieldType.name

    if (value === undefined || value === null || value === '') return

    fieldTypeConfigFields[String(value)] = normalizeConfigFields(
      fieldType.config_fields ?? fieldType.configFields,
    )
  })

  return {
    fieldTypes,
    commonConfigFields: normalizeConfigFields(
      payload?.common_config_fields ?? payload?.commonConfigFields,
    ),
    fieldTypeConfigFields,
  }
}
