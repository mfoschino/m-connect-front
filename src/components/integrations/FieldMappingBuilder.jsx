import { Fragment, useEffect, useMemo, useState } from 'react'
import { RotateCcw, Settings2 } from 'lucide-react'
import Button from '../ui/Button'
import { getEntityFieldSpec } from '../../constants/connectors'
import {
  CONSTANT_SOURCE_FIELD,
  getMappingValidationErrors,
  isConstantFieldType,
  mapBackendMappingListToForm,
} from '../../services/adapters/mappingAdapter'
import MappingConfigFields from './MappingConfigFields'

const CORE_CONFIG_FIELDS = new Set(['source_field', 'target_field', 'on_error'])

const normalize = (value = '') => String(value).replace(/[\s_-]+/g, '').toLowerCase()

const includeCurrentOption = (options, currentValue) => {
  if (!currentValue || options.some((option) => option.value === currentValue)) return options
  return [{ value: currentValue, label: `${currentValue} (no disponible)` }, ...options]
}

const getRawMappingsText = (fieldMappings) => (
  typeof fieldMappings === 'string'
    ? fieldMappings
    : JSON.stringify(fieldMappings ?? [], null, 2)
)

const RawMappingsEditor = ({
  fieldMappings,
  setFieldMappings,
  validationMetadata,
  disabled = false,
}) => {
  const [text, setText] = useState(() => getRawMappingsText(fieldMappings))
  const [error, setError] = useState('')

  const handleChange = (event) => {
    const nextText = event.target.value
    setText(nextText)

    try {
      const parsed = JSON.parse(nextText)
      if (!Array.isArray(parsed)) {
        throw new Error('La configuración debe ser un arreglo JSON.')
      }
      const validationErrors = getMappingValidationErrors(parsed, validationMetadata)
      setError(validationErrors[0] ?? '')
      setFieldMappings(mapBackendMappingListToForm(parsed))
    } catch (parseError) {
      setError(parseError.message || 'JSON inválido.')
      setFieldMappings(nextText)
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <label htmlFor="raw-field-mappings" className="block text-sm font-semibold text-slate-900">
        Configuración de mapeos (JSON)
      </label>
      <textarea
        id="raw-field-mappings"
        value={text}
        onChange={handleChange}
        className="form-input min-h-[220px] w-full font-mono text-sm"
        aria-invalid={Boolean(error)}
        disabled={disabled}
      />
      <p className="text-sm text-slate-500">
        Podés editar el arreglo de mapeos aunque esta entidad todavía no tenga un catálogo visual de campos.
      </p>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

const FieldMappingBuilder = ({
  entityId,
  fieldMappings,
  setFieldMappings,
  fieldTypes = [],
  commonConfigFields = [],
  fieldTypeConfigFields = {},
  onErrorStrategies = [],
  metadataLoading = false,
  metadataError = null,
  autoMapEnabled = true,
}) => {
  const [expandedRows, setExpandedRows] = useState(() => new Set())
  const [rawMode, setRawMode] = useState(false)
  const entitySpec = useMemo(() => getEntityFieldSpec(entityId), [entityId])
  const { sourceFields = [], destinationFields = [] } = entitySpec || {}
  const defaultFieldType = fieldTypes[0]?.value ?? ''
  const defaultOnErrorStrategy = onErrorStrategies[0]?.value ?? ''
  const validationMetadata = {
    fieldTypes,
    onErrorStrategies,
    fieldTypeConfigFields,
  }

  useEffect(() => {
    if (!autoMapEnabled) return
    if (!entityId) return
    if (metadataLoading || metadataError || !defaultFieldType || !defaultOnErrorStrategy) return
    if (sourceFields.length === 0) return

    setFieldMappings((currentMappings) => {
      if (!Array.isArray(currentMappings) || currentMappings.length > 0) return currentMappings

      return sourceFields.map((sourceField) => {
        let match = destinationFields.find((destinationField) => destinationField.id === sourceField.id)
        if (!match) match = destinationFields.find((destinationField) => destinationField.label === sourceField.label)
        if (!match) match = destinationFields.find((destinationField) => destinationField.label.toLowerCase() === String(sourceField.label).toLowerCase())
        if (!match) match = destinationFields.find((destinationField) => normalize(destinationField.label) === normalize(sourceField.label))

        return {
          source_field: sourceField.id,
          source_label: sourceField.label,
          target_field: match ? match.id : '',
          target_label: match ? match.label : '',
          field_type: defaultFieldType,
          on_error: defaultOnErrorStrategy,
          auto_mapped: Boolean(match),
          required: match?.required === true,
        }
      })
    })
  }, [
    autoMapEnabled,
    defaultFieldType,
    defaultOnErrorStrategy,
    destinationFields,
    entityId,
    metadataError,
    metadataLoading,
    setFieldMappings,
    sourceFields,
  ])

  const toggleRow = (index) => {
    setExpandedRows((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleUpdateMapping = (index, key, value) => {
    setFieldMappings((currentMappings) => {
      if (!Array.isArray(currentMappings)) return currentMappings

      const updated = [...currentMappings]
      const currentMapping = updated[index]
      const nextMapping = { ...currentMapping, [key]: value }

      if (key === 'field_type') {
        const wasConstant = isConstantFieldType(currentMapping.field_type)
        const willBeConstant = isConstantFieldType(value)
        const previousFields = fieldTypeConfigFields[currentMapping.field_type] ?? []
        const nextFieldNames = new Set(
          (fieldTypeConfigFields[value] ?? []).map((field) => field.name),
        )

        previousFields.forEach((field) => {
          if (nextFieldNames.has(field.name)) return
          if (field.name === 'value') delete nextMapping.constant_value
          else delete nextMapping[field.name]
        })

        if (willBeConstant) {
          if (!wasConstant) {
            nextMapping.source_field_before_constant = currentMapping.source_field
          }
          nextMapping.source_field = CONSTANT_SOURCE_FIELD
        } else {
          if (wasConstant) {
            if (currentMapping.source_field_before_constant) {
              nextMapping.source_field = currentMapping.source_field_before_constant
            } else {
              delete nextMapping.source_field
            }
          }
          delete nextMapping.constant_value
          delete nextMapping.source_field_before_constant
        }
      }

      updated[index] = nextMapping
      return updated
    })

    if (key === 'field_type') {
      setExpandedRows((current) => new Set(current).add(index))
    }
  }

  const handleConfigChange = (index, key, value) => {
    setFieldMappings((currentMappings) => {
      if (!Array.isArray(currentMappings)) return currentMappings

      const updated = [...currentMappings]
      const nextMapping = { ...updated[index] }

      if (value === undefined) delete nextMapping[key]
      else nextMapping[key] = value

      updated[index] = nextMapping
      return updated
    })
  }

  const renderMetadataState = () => (
    <>
      {metadataLoading ? (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
          Cargando tipos de campo y estrategias de error...
        </p>
      ) : null}
      {metadataError ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          No se pudieron cargar los metadatos de mapeos: {metadataError}
        </p>
      ) : null}
    </>
  )

  if (!entityId) {
    return (
      <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Seleccione primero una entidad</p>
        <p className="mt-1 text-sm text-amber-700">El mapeo de campos se habilita después de elegirla.</p>
      </div>
    )
  }

  if (rawMode) {
    return (
      <div className="space-y-4 rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
        {renderMetadataState()}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
              <p className="text-sm font-semibold text-slate-900">Edición completa de mapeos</p>
            <p className="mt-1 text-sm text-slate-600">
              El arreglo conserva los metadatos y la validación recursiva del formulario.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setRawMode(false)}>
            Volver al editor visual
          </Button>
        </div>
        <RawMappingsEditor
          fieldMappings={fieldMappings}
          setFieldMappings={setFieldMappings}
          validationMetadata={validationMetadata}
          disabled={metadataLoading}
        />
      </div>
    )
  }

  if (
    !Array.isArray(fieldMappings)
    || sourceFields.length === 0
    || (!autoMapEnabled && fieldMappings.length === 0)
  ) {
    return (
      <div className="space-y-4 rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
        {renderMetadataState()}
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {!Array.isArray(fieldMappings)
              ? 'La configuración JSON necesita corrección'
              : 'No hay campos configurados para esta entidad todavía'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            El catálogo visual local aún no incluye esta entidad; puede mantener su configuración mediante JSON.
          </p>
        </div>
        <RawMappingsEditor
          fieldMappings={fieldMappings}
          setFieldMappings={setFieldMappings}
          validationMetadata={validationMetadata}
          disabled={metadataLoading}
        />
      </div>
    )
  }

  const mappings = fieldMappings
  const autoMappedCount = mappings.filter((mapping) => mapping.auto_mapped).length
  const needsAttentionCount = mappings.filter(
    (mapping) => getMappingValidationErrors([mapping], validationMetadata).length > 0,
  ).length
  const requiredUnmapped = destinationFields.filter(
    (destinationField) => destinationField.required === true
      && !mappings.find((mapping) => mapping.target_field === destinationField.id),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Mapeo de campos</h3>
          <p className="mt-1 text-sm text-slate-600">
              Los mapeos sugeridos se pueden ajustar y configurar según el tipo informado por el servidor.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setRawMode(true)}>
          Editar JSON completo
        </Button>
      </div>

      {renderMetadataState()}

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm text-slate-700">
          <strong className="text-slate-900">{autoMappedCount} mapeados automáticamente</strong>
          <span className="ml-3">
            {needsAttentionCount > 0
              ? `${needsAttentionCount} requieren atención`
              : 'Todos los mapeos son válidos'}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setFieldMappings([])}
          title="Restablecer mapeos"
        >
          <RotateCcw size={16} aria-hidden="true" />
          Restablecer
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed text-sm">
          <thead>
            <tr className="text-left text-slate-700">
              <th className="py-2">Campo origen</th>
              <th className="py-2">Campo destino</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Ante error</th>
              <th className="w-24 py-2">Requerido</th>
              <th className="w-40 py-2">Configuración</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((mapping, index) => {
              const selectedFieldType = fieldTypes.find(
                (option) => option.value === mapping.field_type,
              )
              const srcLabel = isConstantFieldType(mapping.field_type)
                ? 'Valor constante'
                : mapping.source_label
                  || sourceFields.find((field) => field.id === mapping.source_field)?.label
                  || mapping.source_field
              const isUnmapped = !mapping.target_field
              const mappingFieldTypes = includeCurrentOption(fieldTypes, mapping.field_type)
              const mappingOnErrorStrategies = includeCurrentOption(
                onErrorStrategies,
                mapping.on_error,
              )
              const configFields = [
                ...commonConfigFields.filter((field) => !CORE_CONFIG_FIELDS.has(field.name)),
                ...(fieldTypeConfigFields[mapping.field_type] ?? []),
              ]
                .filter((field, fieldIndex, allFields) => (
                  allFields.findIndex((candidate) => candidate.name === field.name) === fieldIndex
                ))
                .map((field) => (
                  field.name === 'value' && isConstantFieldType(mapping.field_type)
                    ? { ...field, name: 'constant_value', label: 'Valor' }
                    : field
                ))
              const isExpanded = expandedRows.has(index)

              return (
                <Fragment key={`${mapping.source_field || 'mapping'}-${index}`}>
                  <tr className={isUnmapped ? 'bg-amber-50' : ''}>
                    <td className="py-3 pr-4">{srcLabel || '—'}</td>
                    <td className="py-3 pr-4">
                      <select
                        value={mapping.target_field || ''}
                        onChange={(event) => handleUpdateMapping(index, 'target_field', event.target.value)}
                        className="form-input w-full"
                      >
                        <option value="">Sin mapear</option>
                        {destinationFields.map((destinationField) => (
                          <option key={destinationField.id} value={destinationField.id}>
                            {destinationField.label}{destinationField.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={mapping.field_type || ''}
                        onChange={(event) => handleUpdateMapping(index, 'field_type', event.target.value)}
                        className="form-input w-full"
                        disabled={metadataLoading || Boolean(metadataError)}
                        title={selectedFieldType?.description}
                      >
                        <option value="">Seleccionar tipo</option>
                        {mappingFieldTypes.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4">
                      <select
                        value={mapping.on_error || ''}
                        onChange={(event) => handleUpdateMapping(index, 'on_error', event.target.value)}
                        className="form-input w-full"
                        disabled={metadataLoading || Boolean(metadataError)}
                      >
                        <option value="">Seleccionar estrategia</option>
                        {mappingOnErrorStrategies.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(mapping.required)}
                        onChange={(event) => handleUpdateMapping(index, 'required', event.target.checked)}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => toggleRow(index)}
                        disabled={!mapping.field_type}
                        title={isExpanded ? 'Ocultar configuración' : 'Editar configuración'}
                      >
                        <Settings2 size={16} aria-hidden="true" />
                        {isExpanded ? 'Ocultar' : 'Configurar'}
                      </Button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="border-b border-slate-200 bg-white">
                      <td colSpan="6" className="px-4 py-4">
                        {selectedFieldType?.description ? (
                          <p className="mb-4 text-sm text-slate-600">
                            {selectedFieldType.description}
                          </p>
                        ) : null}
                        {configFields.length > 0 ? (
                          <MappingConfigFields
                            fields={configFields}
                            mapping={mapping}
                            onChange={(key, value) => handleConfigChange(index, key, value)}
                            validationMetadata={validationMetadata}
                          />
                        ) : (
                          <p className="text-sm text-slate-500">
                            Este tipo no requiere configuración adicional.
                          </p>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {requiredUnmapped.length > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <strong>Campos requeridos sin mapear:</strong>
          <ul className="mt-2 list-disc pl-5">
            {requiredUnmapped.map((destinationField) => (
              <li key={destinationField.id}>{destinationField.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default FieldMappingBuilder
