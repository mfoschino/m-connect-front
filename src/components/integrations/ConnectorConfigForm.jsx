/**
 * ConnectorConfigForm Component
 * Provides connector-specific form fields instead of raw JSON editor
 * Translates business-friendly inputs to config object for backend
 * 
 * Usage:
 * <ConnectorConfigForm
 *   connectorType="api"
 *   sourceSystemName="Salesforce"
 *   config={configObject}
 *   setConfig={setConfigFunction}
 *   error={errorText}
 * />
 * 
 * The component collects form fields and converts them to a config object
 * that gets passed to the API unchanged (for backward compatibility)
 */

import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { getConnectorSchema } from '../../constants/connectors'

const isJsonObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
)

const formatJsonValue = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

const validateJsonDraft = (field, value) => {
  if (!value.trim()) {
    return field.required ? `El campo ${field.label} es obligatorio.` : ''
  }

  try {
    const parsedValue = JSON.parse(value)
    if (field.objectOnly && !isJsonObject(parsedValue)) {
      return `${field.label} debe ser un objeto JSON.`
    }
    return ''
  } catch {
    return `El JSON de ${field.label} no es válido.`
  }
}

const getInitialJsonState = (schema, config) => {
  const drafts = {}
  const errors = {}

  schema?.fields
    .filter((field) => field.type === 'json')
    .forEach((field) => {
      const draft = formatJsonValue(config?.[field.id])
      drafts[field.id] = draft
      const validationError = validateJsonDraft(field, draft)
      if (validationError) errors[field.id] = validationError
    })

  return { drafts, errors }
}

const ConnectorConfigForm = ({
  connectorType,
  sourceSystemName,
  config = {},
  setConfig,
  error,
  onValidationChange,
}) => {
  const schema = useMemo(() => getConnectorSchema(connectorType), [connectorType])
  const initialJsonState = useMemo(
    () => getInitialJsonState(schema, config),
    [config, schema],
  )
  const [jsonDrafts, setJsonDrafts] = useState(initialJsonState.drafts)
  const [jsonErrors, setJsonErrors] = useState(initialJsonState.errors)

  useEffect(() => {
    onValidationChange?.(jsonErrors)
  }, [jsonErrors, onValidationChange])

  const handleFieldChange = (field, value) => {
    const normalizedValue = field.nullable && value === '' ? null : value
    const newValues = { ...config, [field.id]: normalizedValue }
    // Update parent with config object
    setConfig(newValues)
  }

  const handleJsonChange = (field, value) => {
    setJsonDrafts((current) => ({ ...current, [field.id]: value }))

    const validationError = validateJsonDraft(field, value)
    setJsonErrors((current) => {
      const nextErrors = { ...current }
      if (validationError) nextErrors[field.id] = validationError
      else delete nextErrors[field.id]
      return nextErrors
    })

    if (validationError) return

    const newValues = { ...config }
    if (!value.trim()) delete newValues[field.id]
    else newValues[field.id] = JSON.parse(value)

    setConfig(newValues)
  }

  const handleTestConnection = async () => {
    // TODO: Implement connection testing
    // This should call a backend endpoint to validate the connection
    console.log('Testing connection with config:', config)
    alert('Connection test not yet implemented. Configuration saved.')
  }

  if (!schema) {
    return (
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">No connector type selected</p>
        <p className="mt-1 text-sm text-amber-700">Go back to select a source system first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Connect {sourceSystemName || 'Source System'}</h3>
        <p className="mt-1 text-sm text-slate-600">Enter the connection details below. All information is securely encrypted.</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        {schema.fields.map((field) => {
          // Check if field should be visible based on dependencies
          const dependsOn = field.dependsOn
          const shouldShowField = !dependsOn || config[dependsOn.field] === dependsOn.value

          if (!shouldShowField) return null

          const value = config[field.id] ?? ''

          switch (field.type) {
            case 'text':
            case 'number':
            case 'password':
              return (
                <div key={field.id}>
                  <Input
                    id={`config-${field.id}`}
                    label={field.label}
                    type={field.type}
                    value={value}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                    description={field.description}
                  />
                </div>
              )

            case 'select':
              return (
                <div key={field.id}>
                  <label htmlFor={`config-${field.id}`} className="block text-sm font-medium text-slate-900">
                    {field.label}
                    {field.required ? <span className="text-red-600">*</span> : null}
                  </label>
                  <select
                    id={`config-${field.id}`}
                    value={value}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    className="form-input mt-2 w-full"
                    required={field.required}
                  >
                    <option value="">Select {field.label.toLowerCase()}</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {field.description && <p className="mt-1 text-sm text-slate-500">{field.description}</p>}
                </div>
              )

            case 'textarea':
              return (
                <div key={field.id}>
                  <label htmlFor={`config-${field.id}`} className="block text-sm font-medium text-slate-900">
                    {field.label}
                    {field.required ? <span className="text-red-600">*</span> : null}
                  </label>
                  <textarea
                    id={`config-${field.id}`}
                    value={value}
                    onChange={(e) => handleFieldChange(field, e.target.value)}
                    placeholder={field.placeholder}
                    className="form-input mt-2 w-full min-h-[100px] font-mono text-sm"
                    required={field.required}
                  />
                  {field.description && <p className="mt-1 text-sm text-slate-500">{field.description}</p>}
                </div>
              )

            case 'json': {
              const jsonError = jsonErrors[field.id]

              return (
                <div key={field.id}>
                  <label htmlFor={`config-${field.id}`} className="block text-sm font-medium text-slate-900">
                    {field.label}
                    {field.required ? <span className="text-red-600">*</span> : null}
                  </label>
                  <textarea
                    id={`config-${field.id}`}
                    value={jsonDrafts[field.id] ?? ''}
                    onChange={(e) => handleJsonChange(field, e.target.value)}
                    placeholder={field.placeholder}
                    className={`form-input mt-2 min-h-[130px] w-full font-mono text-sm ${
                      jsonError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
                    }`}
                    required={field.required}
                    aria-invalid={Boolean(jsonError)}
                    aria-describedby={jsonError ? `config-${field.id}-error` : undefined}
                  />
                  {jsonError ? (
                    <p id={`config-${field.id}-error`} className="mt-1 text-sm font-medium text-red-600">
                      {jsonError}
                    </p>
                  ) : field.description ? (
                    <p className="mt-1 text-sm text-slate-500">{field.description}</p>
                  ) : null}
                </div>
              )
            }

            case 'checkbox':
              return (
                <div key={field.id} className="flex items-center gap-3">
                  <input
                    id={`config-${field.id}`}
                    type="checkbox"
                    checked={value === true || value === 'true'}
                    onChange={(e) => handleFieldChange(field, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                  />
                  <label htmlFor={`config-${field.id}`} className="text-sm font-medium text-slate-900">
                    {field.label}
                  </label>
                </div>
              )

            default:
              return null
          }
        })}
      </form>

      {/* Test Connection Button */}
      <div className="flex gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" onClick={handleTestConnection}>
          Test Connection
        </Button>
        <p className="text-sm text-slate-600 flex items-center">Optional - Verify connection before proceeding</p>
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {/* Extension Points */}
      <details className="rounded-2xl border border-slate-200 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-700">Configuration Details</summary>
        <div className="mt-3 space-y-2 text-slate-600">
          <p>
            <strong>Fields collected:</strong> {Object.keys(config).length}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-slate-700">Config Object</summary>
            <pre className="mt-2 bg-slate-50 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(config, null, 2)}
            </pre>
          </details>
        </div>
      </details>
    </div>
  )
}

export default ConnectorConfigForm

