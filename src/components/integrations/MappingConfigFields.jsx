import { useState } from 'react'
import Input from '../ui/Input'
import { getMappingValidationErrors } from '../../services/adapters/mappingAdapter'

const inferValueType = (value) => {
  if (value === null) return 'null'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'string'
}

const getDefaultValue = (valueType) => {
  if (valueType === 'number') return 0
  if (valueType === 'boolean') return false
  if (valueType === 'null') return null
  return ''
}

const AnyValueField = ({ field, value, onChange }) => {
  const [valueType, setValueType] = useState(() => inferValueType(value))

  const handleTypeChange = (event) => {
    const nextType = event.target.value
    setValueType(nextType)
    onChange(getDefaultValue(nextType))
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`mapping-config-${field.name}`} className="block text-sm font-semibold text-slate-900">
        {field.label}{field.required ? ' *' : ''}
      </label>
      <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
        <select
          aria-label={`Tipo de valor para ${field.label}`}
          value={valueType}
          onChange={handleTypeChange}
          className="form-input w-full"
        >
          <option value="string">Texto</option>
          <option value="number">Número</option>
          <option value="boolean">Booleano</option>
          <option value="null">Nulo</option>
        </select>
        {valueType === 'boolean' ? (
          <select
            id={`mapping-config-${field.name}`}
            value={String(value)}
            onChange={(event) => onChange(event.target.value === 'true')}
            className="form-input w-full"
          >
            <option value="false">Falso</option>
            <option value="true">Verdadero</option>
          </select>
        ) : valueType === 'null' ? (
          <input
            id={`mapping-config-${field.name}`}
            value="null"
            className="form-input w-full bg-slate-50 text-slate-500"
            disabled
            readOnly
          />
        ) : (
          <input
            id={`mapping-config-${field.name}`}
            type={valueType === 'number' ? 'number' : 'text'}
            value={value ?? ''}
            onChange={(event) => {
              const nextValue = event.target.value
              if (nextValue === '' && !field.required) {
                onChange(undefined)
                return
              }
              onChange(valueType === 'number' && nextValue !== '' ? Number(nextValue) : nextValue)
            }}
            className="form-input w-full"
          />
        )}
      </div>
      {field.description ? <p className="text-sm text-slate-500">{field.description}</p> : null}
    </div>
  )
}

const getJsonListError = (field, value, validationMetadata) => {
  if (!Array.isArray(value)) return 'Debe ser un arreglo JSON.'
  if (field.required && value.length === 0) return 'Este campo es obligatorio.'

  if (field.type === 'list[string]' && value.some((item) => typeof item !== 'string')) {
    return 'Todos los elementos deben ser cadenas de texto.'
  }

  if (field.type === 'list[mapper]') {
    return getMappingValidationErrors(value, validationMetadata)[0] ?? ''
  }

  return ''
}

const JsonListField = ({
  field,
  value,
  onChange,
  validationMetadata,
}) => {
  const [text, setText] = useState(() => (
    typeof value === 'string' ? value : JSON.stringify(value ?? [], null, 2)
  ))
  const [error, setError] = useState(() => (
    typeof value === 'string' ? '' : getJsonListError(field, value ?? [], validationMetadata)
  ))

  const handleChange = (event) => {
    const nextText = event.target.value
    setText(nextText)

    if (!nextText.trim()) {
      setError(field.required ? 'Este campo es obligatorio.' : '')
      onChange(undefined)
      return
    }

    try {
      const parsed = JSON.parse(nextText)
      if (!Array.isArray(parsed)) {
        throw new Error('Debe ser un arreglo JSON.')
      }
      setError(getJsonListError(field, parsed, validationMetadata))
      onChange(parsed)
    } catch (parseError) {
      setError(parseError.message || 'JSON inválido.')
      onChange(nextText)
    }
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <label htmlFor={`mapping-config-${field.name}`} className="block text-sm font-semibold text-slate-900">
        {field.label}{field.required ? ' *' : ''}
      </label>
      <textarea
        id={`mapping-config-${field.name}`}
        value={text}
        onChange={handleChange}
        className="form-input min-h-[120px] w-full font-mono text-sm"
        aria-invalid={Boolean(error)}
      />
      {field.description ? <p className="text-sm text-slate-500">{field.description}</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

const MappingConfigFields = ({
  fields,
  mapping,
  onChange,
  validationMetadata,
}) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {fields.map((field) => {
      const value = mapping[field.name]

      if (field.type === 'any') {
        return (
          <AnyValueField
            key={field.name}
            field={field}
            value={value}
            onChange={(nextValue) => onChange(field.name, nextValue)}
            validationMetadata={validationMetadata}
          />
        )
      }

      if (field.type?.startsWith('list[')) {
        return (
          <JsonListField
            key={field.name}
            field={field}
            value={value}
            onChange={(nextValue) => onChange(field.name, nextValue)}
            validationMetadata={validationMetadata}
          />
        )
      }

      return (
        <Input
          key={field.name}
          id={`mapping-config-${field.name}`}
          label={`${field.label}${field.required ? ' *' : ''}`}
          value={value ?? ''}
          onChange={(event) => onChange(field.name, event.target.value || undefined)}
          helperText={field.description}
        />
      )
    })}
  </div>
)

export default MappingConfigFields
