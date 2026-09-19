import { isConstantFieldType } from './mappingAdapter.js'

const isMapping = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

const hasOwn = (value, key) => (
  isMapping(value) && Object.prototype.hasOwnProperty.call(value, key)
)

const isUsableTechnicalField = (value) => typeof value === 'string' && value.length > 0

const getProfileMappings = (profile) => (
  Array.isArray(profile?.config) ? profile.config.filter(isMapping) : []
)

const getSubMappings = (mapping) => (
  Array.isArray(mapping?.sub_mappings) ? mapping.sub_mappings.filter(isMapping) : []
)

const joinObservedPath = (parentPath, field, parentType) => {
  if (!isUsableTechnicalField(field)) return parentPath
  if (!parentPath) return field

  const parentSuffix = parentType === 'table' ? '[]' : ''
  return `${parentPath}${parentSuffix}.${field}`
}

const getConstantValue = (mapping) => {
  if (hasOwn(mapping, 'constant_value')) return mapping.constant_value
  if (hasOwn(mapping, 'value')) return mapping.value
  return undefined
}

const toMappingDescriptor = (mapping, details) => ({
  sourceField: isConstantFieldType(mapping.field_type)
    ? null
    : isUsableTechnicalField(mapping.source_field) ? mapping.source_field : '',
  targetField: isUsableTechnicalField(mapping.target_field) ? mapping.target_field : '',
  fieldType: typeof mapping.field_type === 'string' ? mapping.field_type : '',
  constantValue: getConstantValue(mapping),
  lookupTableCode: mapping.lookup_table_code ?? mapping.lookup_table_name ?? '',
  expression: mapping.expression ?? '',
  sourceFormat: mapping.source_format ?? '',
  targetFormat: mapping.target_format ?? '',
  defaultValue: mapping.default_value,
  onError: mapping.on_error ?? '',
  ...details,
})

const getObservedContainerType = (producerEntries, consumerEntries) => {
  const structuralTypes = new Set(
    [...producerEntries, ...consumerEntries]
      .map((entry) => entry.mapping.field_type)
      .filter((fieldType) => fieldType === 'table' || fieldType === 'nested_object'),
  )

  return structuralTypes.size === 1 ? [...structuralTypes][0] : ''
}

const describeProducer = (entry, canonicalPath) => (
  toMappingDescriptor(entry.mapping, {
    direction: 'inbound',
    canonicalPath,
    targetPath: canonicalPath,
  })
)

const describeConsumer = (entry, canonicalPath) => (
  toMappingDescriptor(entry.mapping, {
    direction: 'outbound',
    canonicalPath,
    targetPath: joinObservedPath(
      entry.destinationParentPath,
      entry.mapping.target_field,
      entry.destinationParentType,
    ),
  })
)

const collectUnassociatedOutboundTree = ({
  entry,
  outboundConstants,
  unassociatedOutboundRules,
}) => {
  const mapping = entry.mapping
  const targetPath = joinObservedPath(
    entry.destinationParentPath,
    mapping.target_field,
    entry.destinationParentType,
  )
  const descriptor = toMappingDescriptor(mapping, {
    direction: 'outbound',
    canonicalPath: '',
    targetPath,
  })

  if (isConstantFieldType(mapping.field_type)) {
    outboundConstants.push(descriptor)
  } else {
    unassociatedOutboundRules.push(descriptor)
  }

  getSubMappings(mapping).forEach((childMapping) => {
    collectUnassociatedOutboundTree({
      entry: {
        mapping: childMapping,
        destinationParentPath: targetPath,
        destinationParentType: mapping.field_type,
      },
      outboundConstants,
      unassociatedOutboundRules,
    })
  })
}

const buildTraceLevel = ({
  inboundEntries,
  outboundEntries,
  canonicalParentPath,
  canonicalParentType,
  outboundConstants,
  unassociatedOutboundRules,
}) => {
  const producerEntries = inboundEntries.filter((entry) => (
    isUsableTechnicalField(entry.mapping.target_field)
  ))
  const consumerEntries = []

  outboundEntries.forEach((entry) => {
    const mapping = entry.mapping

    if (isConstantFieldType(mapping.field_type)) {
      collectUnassociatedOutboundTree({
        entry,
        outboundConstants,
        unassociatedOutboundRules,
      })
      return
    }

    if (isUsableTechnicalField(mapping.source_field)) {
      consumerEntries.push(entry)
      return
    }

    collectUnassociatedOutboundTree({
      entry,
      outboundConstants,
      unassociatedOutboundRules,
    })
  })

  const fieldNames = []
  const seenFields = new Set()
  const addField = (field) => {
    if (!isUsableTechnicalField(field) || seenFields.has(field)) return
    seenFields.add(field)
    fieldNames.push(field)
  }

  producerEntries.forEach((entry) => addField(entry.mapping.target_field))
  consumerEntries.forEach((entry) => addField(entry.mapping.source_field))

  return fieldNames.map((canonicalField) => {
    const matchingProducers = producerEntries.filter((entry) => (
      entry.mapping.target_field === canonicalField
    ))
    const matchingConsumers = consumerEntries.filter((entry) => (
      entry.mapping.source_field === canonicalField
    ))
    const canonicalPath = joinObservedPath(
      canonicalParentPath,
      canonicalField,
      canonicalParentType,
    )
    const producers = matchingProducers.map((entry) => describeProducer(entry, canonicalPath))
    const consumers = matchingConsumers.map((entry) => describeConsumer(entry, canonicalPath))
    const branches = []

    const addBranch = ({ kind, producerEntry, consumerEntry }) => {
      const producerType = producerEntry?.mapping.field_type
      const consumerType = consumerEntry?.mapping.field_type
      const containerType = producerEntry ? producerType : consumerType
      const childInboundEntries = producerEntry
        ? getSubMappings(producerEntry.mapping).map((mapping) => ({ mapping }))
        : []
      const childOutboundEntries = consumerEntry
        ? getSubMappings(consumerEntry.mapping).map((mapping) => ({
            mapping,
            destinationParentPath: joinObservedPath(
              consumerEntry.destinationParentPath,
              consumerEntry.mapping.target_field,
              consumerEntry.destinationParentType,
            ),
            destinationParentType: consumerEntry.mapping.field_type,
          }))
        : []

      if (childInboundEntries.length === 0 && childOutboundEntries.length === 0) return

      branches.push({
        kind,
        containerType: typeof containerType === 'string' ? containerType : '',
        producer: producerEntry ? describeProducer(producerEntry, canonicalPath) : null,
        consumer: consumerEntry ? describeConsumer(consumerEntry, canonicalPath) : null,
        children: buildTraceLevel({
          inboundEntries: childInboundEntries,
          outboundEntries: childOutboundEntries,
          canonicalParentPath: canonicalPath,
          canonicalParentType: containerType,
          outboundConstants,
          unassociatedOutboundRules,
        }),
      })
    }

    const isUniqueCompatiblePair = (
      matchingProducers.length === 1
      && matchingConsumers.length === 1
      && matchingProducers[0].mapping.field_type === matchingConsumers[0].mapping.field_type
    )

    if (isUniqueCompatiblePair) {
      addBranch({
        kind: 'paired',
        producerEntry: matchingProducers[0],
        consumerEntry: matchingConsumers[0],
      })
    } else {
      matchingProducers.forEach((producerEntry) => {
        addBranch({ kind: 'producer', producerEntry })
      })
      matchingConsumers.forEach((consumerEntry) => {
        addBranch({ kind: 'consumer', consumerEntry })
      })
    }

    return {
      canonicalField,
      canonicalPath,
      containerType: getObservedContainerType(matchingProducers, matchingConsumers),
      producers,
      consumers,
      branches,
    }
  })
}

export const buildCanonicalFlowTrace = ({ inboundProfile, outboundProfile } = {}) => {
  const outboundConstants = []
  const unassociatedOutboundRules = []
  const fields = buildTraceLevel({
    inboundEntries: getProfileMappings(inboundProfile).map((mapping) => ({ mapping })),
    outboundEntries: getProfileMappings(outboundProfile).map((mapping) => ({
      mapping,
      destinationParentPath: '',
      destinationParentType: '',
    })),
    canonicalParentPath: '',
    canonicalParentType: '',
    outboundConstants,
    unassociatedOutboundRules,
  })

  return { fields, outboundConstants, unassociatedOutboundRules }
}
