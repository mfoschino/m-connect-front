import { useCallback, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import {
  getProfileFlowRole,
  mapBackendProfileToForm,
} from '../../services/adapters/profileAdapter'
import { getMappingValidationErrors } from '../../services/adapters/mappingAdapter'
import FieldMappingBuilder from './FieldMappingBuilder'

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
  metadataLoading = false,
  metadataError = null,
}) => {
  const [values, setValues] = useState(() => {
    const formValues = mapBackendProfileToForm(initialValues)

    return {
      name: formValues.name || '',
      source_system: formValues.source_system || '',
      source_entity: formValues.source_entity || '',
      version: formValues.version || '',
      active: formValues.active,
      config: formValues.config ?? [],
    }
  })
  const [error, setError] = useState('')

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

  const handleSubmit = (event) => {
    event.preventDefault()
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

    onSubmit({
      name: values.name,
      source_system: values.source_system,
      source_entity: values.source_entity,
      version: values.version,
      active: values.active,
      config: values.config,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          id="profile-name"
          label="Nombre del perfil"
          value={values.name}
          onChange={handleChange('name')}
          required
        />
        <div>
          <Input
            id="profile-source-system"
            label="Sistema origen"
            value={values.source_system}
            onChange={handleChange('source_system')}
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
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="profile-source-entity" className="block text-sm font-semibold text-slate-900">
            Entidad origen
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
              La entidad guardada ya no está disponible en la metadata, pero se conserva para edición.
            </p>
          ) : null}
          {metadataError ? (
            <p className="text-sm text-red-600">No se pudieron cargar las entidades: {metadataError}</p>
          ) : null}
        </div>
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
        entityId={values.source_entity}
        fieldMappings={values.config}
        setFieldMappings={setFieldMappings}
        fieldTypes={fieldTypes}
        commonConfigFields={commonConfigFields}
        fieldTypeConfigFields={fieldTypeConfigFields}
        onErrorStrategies={onErrorStrategies}
        metadataLoading={metadataLoading}
        metadataError={metadataError}
      />

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={metadataLoading || Boolean(metadataError)}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export default ProfileForm
