import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

const LookupTableForm = ({ initialValues, onCancel, onSubmit, submitLabel = 'Guardar tabla' }) => {
  const [values, setValues] = useState({
    name: initialValues?.name || '',
    entriesText: initialValues?.entries ? JSON.stringify(initialValues.entries, null, 2) : '{}',
  })
  const [error, setError] = useState('')

  const handleChange = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    let entries
    try {
      entries = JSON.parse(values.entriesText || '{}')
      if (typeof entries !== 'object' || Array.isArray(entries) || entries === null) {
        throw new Error('Las entradas deben ser un objeto JSON de pares clave/valor.')
      }
    } catch {
      setError('El campo de entradas debe contener JSON válido y un objeto de pares clave/valor.')
      return
    }

    onSubmit({
      name: values.name,
      entries,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        id="lookup-name"
        label="Nombre de la tabla"
        value={values.name}
        onChange={handleChange('name')}
        required
      />
      <div className="space-y-2">
        <label htmlFor="lookup-entries" className="block text-sm font-semibold text-slate-900">
          Entradas de la tabla (JSON)
        </label>
        <textarea
          id="lookup-entries"
          className="form-input min-h-[240px] font-mono text-sm"
          value={values.entriesText}
          onChange={handleChange('entriesText')}
          aria-invalid={Boolean(error)}
        />
        <p className="text-sm text-slate-500">Ingrese un objeto JSON de clave/valor para la tabla de búsqueda.</p>
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

export default LookupTableForm
