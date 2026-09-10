import { useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  LOOKUP_TABLE_PRESETS,
  getLookupTablePreset,
  shouldShowCreationPresets,
} from '../../constants/onboardingPresets'
import {
  LOOKUP_TABLE_CODE_PATTERN,
  buildLookupTablePayload,
  mapLookupTableToForm,
} from '../../services/adapters/lookupTableAdapter'

const hasLookupValues = (values) => (
  Boolean(values.codigo.trim())
  || Boolean(values.name.trim())
  || values.is_active !== true
  || !['', '{}'].includes(values.entriesText.trim())
)

const LookupTableForm = ({
  initialValues,
  onCancel,
  onSubmit,
  submitLabel = 'Guardar tabla',
  showPresets = false,
}) => {
  const [values, setValues] = useState(() => mapLookupTableToForm(initialValues))
  const [error, setError] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const canUsePresets = shouldShowCreationPresets(showPresets, initialValues?.id)

  const handleChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value
    setValues((current) => ({ ...current, [field]: value }))
  }

  const handlePresetChange = (event) => {
    const presetId = event.target.value
    const preset = getLookupTablePreset(presetId)
    if (!preset) return

    if (
      hasLookupValues(values)
      && !window.confirm('Aplicar esta plantilla reemplazará el nombre y las entradas actuales. ¿Continuar?')
    ) {
      return
    }

    setSelectedPresetId(presetId)
    setValues(mapLookupTableToForm(preset.values))
    setError('')
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    const result = buildLookupTablePayload(values)
    if (result.error) {
      setError(result.error)
      return
    }

    onSubmit(result.payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {canUsePresets ? (
        <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <label htmlFor="lookup-preset" className="block text-sm font-semibold text-slate-900">
            Plantilla opcional
          </label>
          <select
            id="lookup-preset"
            value={selectedPresetId}
            onChange={handlePresetChange}
            className="form-input w-full bg-white"
          >
            <option value="">Seleccionar plantilla</option>
            {LOOKUP_TABLE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
          <p className="text-sm text-slate-600">
            La plantilla sólo precarga el formulario. Podés revisar y editar todo antes de crear la tabla.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          id="lookup-code"
          label="Código"
          value={values.codigo}
          onChange={handleChange('codigo')}
          pattern={LOOKUP_TABLE_CODE_PATTERN.source}
          helperText="Identificador técnico estable. Usá letras, números, guiones, guiones bajos o puntos."
          required
        />
        <Input
          id="lookup-name"
          label="Nombre descriptivo"
          value={values.name}
          onChange={handleChange('name')}
          required
        />
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-900">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={handleChange('is_active')}
          className="h-4 w-4 rounded border-slate-300 text-slate-700 focus:ring-slate-500"
        />
        Tabla activa
      </label>
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
          required
        />
        <p className="text-sm text-slate-500">Ingresá un objeto JSON de clave/valor para la tabla de consulta.</p>
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
