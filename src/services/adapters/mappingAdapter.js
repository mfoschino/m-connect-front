export const CONSTANT_FIELD_TYPE = 'constant'
export const CONSTANT_SOURCE_FIELD = '**constant**'
export const DEFAULT_ON_ERROR = 'fail'

const isMappingObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const hasOwn = (value, key) => (
  isMappingObject(value) && Object.prototype.hasOwnProperty.call(value, key)
)

const isBlank = (value) => (
  value === undefined
  || value === null
  || (typeof value === 'string' && value.trim() === '')
)

export const isConstantFieldType = (fieldType) => fieldType === CONSTANT_FIELD_TYPE

export const getBackendMappingSourceField = (mapping = {}) => {
  if (isConstantFieldType(mapping.field_type)) return CONSTANT_SOURCE_FIELD
  return mapping.source_field
}

export const mapBackendMappingToForm = (mapping = {}) => {
  if (!isMappingObject(mapping)) return mapping

  const formMapping = { ...mapping }

  if (isConstantFieldType(mapping.field_type)) {
    formMapping.constant_value = hasOwn(mapping, 'constant_value')
      ? mapping.constant_value
      : hasOwn(mapping, 'value')
        ? mapping.value
        : ''
    formMapping.source_field = CONSTANT_SOURCE_FIELD
    delete formMapping.value
  }

  return formMapping
}

export const mapBackendMappingListToForm = (mappings) => (
  Array.isArray(mappings) ? mappings.map(mapBackendMappingToForm) : mappings
)

export const normalizeBackendMapping = (mapping = {}) => {
  if (!isMappingObject(mapping)) return mapping

  const backendMapping = { ...mapping }
  const normalizedConstantValue = hasOwn(mapping, 'constant_value')
    ? mapping.constant_value
    : mapping.value

  delete backendMapping.auto_mapped
  delete backendMapping.constant_value
  delete backendMapping.required
  delete backendMapping.source_label
  delete backendMapping.source_field_before_constant
  delete backendMapping.target_label

  if (isConstantFieldType(mapping.field_type)) {
    backendMapping.source_field = CONSTANT_SOURCE_FIELD
    backendMapping.value = normalizedConstantValue
  } else {
    backendMapping.source_field = getBackendMappingSourceField(mapping)
  }

  if (isBlank(mapping.on_error)) {
    backendMapping.on_error = DEFAULT_ON_ERROR
  }

  Object.entries(backendMapping).forEach(([fieldName, value]) => {
    if (!Array.isArray(value)) return

    backendMapping[fieldName] = value.map((item) => (
      isMappingObject(item)
      && (
        hasOwn(item, 'field_type')
        || hasOwn(item, 'source_field')
        || hasOwn(item, 'target_field')
        || hasOwn(item, 'on_error')
      )
        ? normalizeBackendMapping(item)
        : item
    ))
  })

  return backendMapping
}

export const normalizeBackendMappingList = (mappings) => (
  Array.isArray(mappings) ? mappings.map(normalizeBackendMapping) : mappings
)

const getMappingFieldValue = (mapping, fieldName) => (
  fieldName === 'value' && isConstantFieldType(mapping.field_type)
    ? hasOwn(mapping, 'constant_value')
      ? mapping.constant_value
      : mapping.value
    : mapping[fieldName]
)

const hasMappingField = (mapping, fieldName) => (
  fieldName === 'value' && isConstantFieldType(mapping.field_type)
    ? hasOwn(mapping, 'constant_value') || hasOwn(mapping, 'value')
    : hasOwn(mapping, fieldName)
)

const getConfigFieldErrors = (mapping, configField, validationMetadata, rowLabel) => {
  const value = getMappingFieldValue(mapping, configField.name)
  const isPresent = hasMappingField(mapping, configField.name)

  if (!isPresent || value === undefined) {
    return configField.required ? [`${rowLabel}: falta ${configField.name}.`] : []
  }

  // "any" accepts false, 0, null and an empty string as intentional values.
  if (configField.type === 'any') return []

  if (!configField.required && (value === null || value === '')) return []

  if (configField.type === 'list[mapper]') {
    if (!Array.isArray(value)) {
      return [`${rowLabel}: ${configField.name} debe ser un arreglo de mappings.`]
    }
    if (configField.required && value.length === 0) {
      return [`${rowLabel}: falta ${configField.name}.`]
    }
    return getMappingListValidationErrors(
      value,
      validationMetadata,
      `${rowLabel} > ${configField.name}`,
      false,
    )
  }

  if (configField.type === 'list[string]') {
    if (!Array.isArray(value)) {
      return [`${rowLabel}: ${configField.name} debe ser un arreglo de strings.`]
    }
    if (configField.required && value.length === 0) {
      return [`${rowLabel}: falta ${configField.name}.`]
    }
    if (value.some((item) => typeof item !== 'string')) {
      return [`${rowLabel}: ${configField.name} solo admite strings.`]
    }
    return []
  }

  if (configField.type?.startsWith('list[')) {
    if (!Array.isArray(value)) {
      return [`${rowLabel}: ${configField.name} debe ser un arreglo.`]
    }
    if (configField.required && value.length === 0) {
      return [`${rowLabel}: falta ${configField.name}.`]
    }
    return []
  }

  if (configField.type === 'string') {
    return typeof value === 'string' && value.trim().length > 0
      ? []
      : [`${rowLabel}: falta ${configField.name}.`]
  }

  return []
}

const getMappingListValidationErrors = (
  mappings,
  validationMetadata,
  labelPrefix,
  requireSourceField = true,
) => {
  if (!Array.isArray(mappings)) {
    return [`${labelPrefix} debe ser un arreglo de mappings.`]
  }

  const {
    fieldTypes = [],
    onErrorStrategies = [],
    fieldTypeConfigFields = {},
  } = validationMetadata
  const validFieldTypes = new Set(fieldTypes.map((option) => option.value))
  const validOnErrorStrategies = new Set(onErrorStrategies.map((option) => option.value))

  return mappings.flatMap((mapping, index) => {
    const rowLabel = `${labelPrefix} ${index + 1}`
    const errors = []

    if (!isMappingObject(mapping)) {
      return [`${rowLabel}: debe ser un objeto.`]
    }

    if (isBlank(mapping.target_field)) errors.push(`${rowLabel}: falta target_field.`)
    if (!validFieldTypes.has(mapping.field_type)) errors.push(`${rowLabel}: field_type inválido.`)
    if (!isBlank(mapping.on_error) && !validOnErrorStrategies.has(mapping.on_error)) {
      errors.push(`${rowLabel}: on_error inválido.`)
    }
    if (
      !isConstantFieldType(mapping.field_type)
      && isBlank(mapping.source_field)
      && (requireSourceField || mapping.field_type !== 'expression')
    ) {
      errors.push(`${rowLabel}: falta source_field.`)
    }

    const configFields = fieldTypeConfigFields[mapping.field_type] ?? []

    configFields.forEach((configField) => {
      errors.push(...getConfigFieldErrors(
        mapping,
        configField,
        validationMetadata,
        rowLabel,
      ))
    })

    return errors
  })
}

export const getMappingValidationErrors = (
  mappings,
  validationMetadata = {},
) => {
  if (!Array.isArray(mappings)) {
    return ['La configuración debe ser un arreglo de mapeos.']
  }

  return getMappingListValidationErrors(mappings, validationMetadata, 'Mapeo')
}
