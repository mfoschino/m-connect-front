import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const ProfileForm = ({ initialValues, onCancel, onSubmit, submitLabel = 'Guardar perfil' }) => {
  const [values, setValues] = useState({
    name: initialValues?.name || '',
    source_system: initialValues?.source_system || '',
    source_entity: initialValues?.source_entity || '',
    version: initialValues?.version || '',
    active: initialValues?.active ?? true,
    configText: initialValues?.config ? JSON.stringify(initialValues.config, null, 2) : '[]',
  })
  const [error, setError] = useState('')

  const handleChange = (field) => (event) => {
    const value = field === 'active' ? event.target.checked : event.target.value
    setValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    let config
    try {
      config = JSON.parse(values.configText || '[]')
      if (!Array.isArray(config)) {
        throw new Error('La configuración debe ser un arreglo de mapeos.')
      }
    } catch {
      setError('El campo de configuración debe contener JSON válido y un arreglo de objetos.')
      return
    }

    onSubmit({
      name: values.name,
      source_system: values.source_system,
      source_entity: values.source_entity,
      version: values.version,
      active: values.active,
      config,
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
        <Input
          id="profile-source-system"
          label="Sistema origen"
          value={values.source_system}
          onChange={handleChange('source_system')}
          required
        />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          id="profile-source-entity"
          label="Entidad origen"
          value={values.source_entity}
          onChange={handleChange('source_entity')}
          required
        />
        <Input
          id="profile-version"
          label="Versión"
          value={values.version}
          onChange={handleChange('version')}
          placeholder="Ej. v1.0"
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
      <div className="space-y-2">
        <label htmlFor="profile-config" className="block text-sm font-semibold text-slate-900">
          Configuración de campo (JSON)
        </label>
        <textarea
          id="profile-config"
          className="form-input min-h-[240px] font-mono text-sm"
          value={values.configText}
          onChange={handleChange('configText')}
          aria-invalid={Boolean(error)}
        />
        <p className="text-sm text-slate-500">
          {'Ingrese un arreglo JSON de objetos de mapeo. Ejemplo: [{"source_field":"foo","target_field":"bar"}]'}
        </p>
      </div>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  )
}

export default ProfileForm
