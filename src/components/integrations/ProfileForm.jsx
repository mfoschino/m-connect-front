import { useCallback, useRef, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import {
  getProfileDisplayName,
  getProfileFlowRole,
  getResetProfileMappings,
  mapBackendProfileToForm,
} from '../../services/adapters/profileAdapter'
import { getMappingValidationErrors } from '../../services/adapters/mappingAdapter'
import {
  MAPPING_PROFILE_PRESETS,
  getMappingProfilePreset,
  shouldShowCreationPresets,
} from '../../constants/onboardingPresets'
import FieldMappingBuilder from './FieldMappingBuilder'

const hasProfileValues = (values) => (
  Boolean(values.source_system.trim())
  || Boolean(values.source_entity.trim())
  || Boolean(values.version.trim())
  || (Array.isArray(values.config) ? values.config.length > 0 : Boolean(values.config))
)

const getInitialFormValues = (initialValues) => {
  const formValues = mapBackendProfileToForm(initialValues)

  return {
    source_system: formValues.source_system || '',
    source_entity: formValues.source_entity || '',
    version: formValues.version || '',
    active: formValues.active,
    config: getResetProfileMappings(formValues.config),
  }
}

const ProfileForm = ({
  initialValues,
  onCancel,
  onSubmit,
  submitLabel = 'Guardar perfil',
  fieldTypes = [],
  commonConfigFields = [],
  fieldTypeConfigFields = {},
  onErrorStrategies = [],
  entityTypes = [],
  lookupTables = [],
  lookupTablesLoading = false,
  metadataLoading = false,
  metadataError = null,
  showPresets = false,
  isEditing = Boolean(initialValues?.id),
  loading = false,
  saveError = '',
}) => {
  const [initialFormValues] = useState(() => getInitialFormValues(initialValues))
  const [values, setValues] = useState(() => ({
    ...initialFormValues,
    config: getResetProfileMappings(initialFormValues.config),
  }))
  const [error, setError] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const [presetNote, setPresetNote] = useState('')
  const [mappingEditorRevision, setMappingEditorRevision] = useState(0)
  const submitInFlight = useRef(false)
  const canUsePresets = shouldShowCreationPresets(showPresets, initialValues?.id)

  const selectedEntityMissing = Boolean(
    values.source_entity
    && !metadataLoading
    && !entityTypes.some((option) => option.value === values.source_entity),
  )
  const entityOptions = selectedEntityMissing
    ? [{ value: values.source_entity, label: `${values.source_entity} (no disponible)` }, ...entityTypes]
    : entityTypes
  const profileFlowRole = getProfileFlowRole(values)

  const handleChange = (field) => (event) => {
    const value = field === 'active' ? event.target.checked : event.target.value
    setValues((current) => ({ ...current, [field]: value }))
  }

  const setFieldMappings = useCallback((nextMappings) => {
    setValues((current) => ({
      ...current,
      config: typeof nextMappings === 'function'
        ? nextMappings(current.config)
        : nextMappings,
    }))
  }, [])

  const handleResetMappings = useCallback(() => {
    setValues((current) => ({
      ...current,
      config: getResetProfileMappings(initialFormValues.config),
    }))
    setMappingEditorRevision((current) => current + 1)
    setError('')
  }, [initialFormValues.config])

  const handlePresetChange = (event) => {
    const presetId = event.target.value
    const preset = getMappingProfilePreset(presetId)
    if (!preset) return

    if (
      hasProfileValues(values)
      && !window.confirm('Aplicar esta plantilla reemplazará los datos y mapeos actuales. ¿Continuar?')
    ) {
      return
    }

    const formValues = mapBackendProfileToForm(preset.values)
    setSelectedPresetId(presetId)
    setPresetNote(preset.note || preset.description || '')
    setValues({
      source_system: formValues.source_system,
      source_entity: formValues.source_entity,
      version: formValues.version,
      active: formValues.active,
      config: formValues.config,
    })
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (loading || submitInFlight.current) return

    setError('')

    const mappingErrors = getMappingValidationErrors(values.config, {
      fieldTypes,
      onErrorStrategies,
      fieldTypeConfigFields,
    })

    if (mappingErrors.length > 0) {
      setError(mappingErrors[0])
      return
    }

    submitInFlight.current = true

    try {
      await onSubmit({
        ...(!isEditing ? {
          source_system: values.source_system,
          source_entity: values.source_entity,
        } : {}),
        version: values.version,
        active: values.active,
        config: values.config,
      })
    } finally {
      submitInFlight.current = false
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {canUsePresets ? (
        <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <label htmlFor="profile-preset" className="block text-sm font-semibold text-slate-900">
            Plantilla opcional
          </label>
          <select
            id="profile-preset"
            value={selectedPresetId}
            onChange={handlePresetChange}
            className="form-input w-full bg-white"
          >
            <option value="">Seleccionar plantilla</option>
            {MAPPING_PROFILE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          <p className="text-sm text-slate-600">
            La plantilla sólo precarga el formulario y no crea recursos automáticamente.
          </p>
          {presetNote ? (
            <p className={`text-sm font-medium ${
              getMappingProfilePreset(selectedPresetId)?.incomplete
                ? 'text-amber-800'
                : 'text-slate-700'
            }`}>
              {presetNote}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Identidad del MappingProfile
        </p>
        <p className="mt-1 font-medium text-slate-900">{getProfileDisplayName(values)}</p>
      </div>

      {isEditing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">MappingProfile compartido</p>
          <p className="mt-1">
            Este MappingProfile es un recurso compartido del tenant. Los cambios pueden afectar
            integraciones compatibles que utilicen esta configuración.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Input
            id="profile-source-system"
            label="Sistema de origen"
            value={values.source_system}
            onChange={handleChange('source_system')}
            readOnly={isEditing}
            helperText={isEditing
              ? 'Forma parte de la identidad y no se puede modificar al editar.'
              : undefined}
            required
          />
          {values.source_system ? (
            <p className="mt-2 text-sm text-slate-500">
              {profileFlowRole === 'outbound'
                ? 'Perfil de salida hacia Finnegans.'
                : 'Perfil de entrada hacia el formato canónico de M-Connect.'}
            </p>
          ) : null}
        </div>
        {isEditing ? (
          <Input
            id="profile-source-entity"
            label="Entidad"
            value={values.source_entity}
            readOnly
            helperText="Forma parte de la identidad y no se puede modificar al editar."
            required
          />
        ) : (
          <div className="space-y-2">
            <label htmlFor="profile-source-entity" className="block text-sm font-semibold text-slate-900">
              Entidad
            </label>
            <select
              id="profile-source-entity"
              value={values.source_entity}
              onChange={handleChange('source_entity')}
              className="form-input w-full"
              disabled={metadataLoading || Boolean(metadataError)}
              required
            >
              <option value="">{metadataLoading ? 'Cargando entidades...' : 'Seleccionar entidad'}</option>
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedEntityMissing ? (
              <p className="text-sm text-amber-700">
                La entidad guardada ya no está disponible en los metadatos, pero se conserva para edición.
              </p>
            ) : null}
            {metadataError ? (
              <p className="text-sm text-red-600">No se pudieron cargar las entidades: {metadataError}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          id="profile-version"
          label="Versión"
          value={values.version}
          onChange={handleChange('version')}
          placeholder="Ej. 1.0.0"
        />
      </div>

      <div className="flex items-center gap-4">
        <input
          id="profile-active"
          type="checkbox"
          checked={values.active}
          onChange={handleChange('active')}
          className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
        />
        <label htmlFor="profile-active" className="text-sm font-medium text-slate-900">
          Perfil activo
        </label>
      </div>

      <FieldMappingBuilder
        key={`${selectedPresetId || initialValues?.id || 'profile-mappings'}-${mappingEditorRevision}`}
        entityId={values.source_entity}
        fieldMappings={values.config}
        setFieldMappings={setFieldMappings}
        fieldTypes={fieldTypes}
        commonConfigFields={commonConfigFields}
        fieldTypeConfigFields={fieldTypeConfigFields}
        onErrorStrategies={onErrorStrategies}
        lookupTables={lookupTables}
        lookupTablesLoading={lookupTablesLoading}
        metadataLoading={metadataLoading}
        metadataError={metadataError}
        autoMapEnabled={!initialValues?.id && !selectedPresetId}
        onResetMappings={handleResetMappings}
      />

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {saveError ? (
        <p role="alert" className="text-sm font-medium text-red-600">{saveError}</p>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading || metadataLoading || Boolean(metadataError)}
        >
          {loading ? 'Guardando...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default ProfileForm
