import { useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import ConnectorConfigForm from './ConnectorConfigForm'
import ScheduleEditor from './ScheduleEditor'

const connectorOptions = ['api', 'db', 'file', 'webhook']
const stepTitles = [
  'Información básica',
  'Tipo de conector',
  'Configuración del conector',
  'Programación',
  'Revisión',
]

const IntegrationForm = ({ mode = 'create', defaultValues = {}, onSubmit, onCancel, loading, errorMessage }) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [name, setName] = useState(defaultValues.name || '')
  const [sourceEntity, setSourceEntity] = useState(defaultValues.source_entity || '')
  const [connectorType, setConnectorType] = useState(defaultValues.connector_type || '')
  const [configText, setConfigText] = useState(defaultValues.config ? JSON.stringify(defaultValues.config, null, 2) : '{}')
  const [scheduleMode, setScheduleMode] = useState(defaultValues.schedule ? 'cron' : 'manual')
  const [cron, setCron] = useState(defaultValues.schedule || '')
  const [stepError, setStepError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const parsedConfig = useMemo(() => {
    try {
      return JSON.parse(configText || '{}')
    } catch {
      return null
    }
  }, [configText])

  const validateStep = (stepToValidate) => {
    setStepError('')
    setFieldErrors({})

    if (stepToValidate === 1) {
      const errors = {}
      if (!name.trim()) errors.name = 'Nombre es obligatorio.'
      if (!sourceEntity.trim()) errors.sourceEntity = 'Entidad fuente es obligatoria.'
      setFieldErrors(errors)
      if (Object.keys(errors).length > 0) {
        setStepError('Completa los campos requeridos para continuar.')
        return false
      }
    }

    if (stepToValidate === 2) {
      if (!connectorType) {
        setStepError('Selecciona un tipo de conector.')
        return false
      }
    }

    if (stepToValidate === 3) {
      if (!configText.trim()) {
        setStepError('Ingresa la configuración del conector en formato JSON.')
        return false
      }
      if (parsedConfig === null || typeof parsedConfig !== 'object' || Array.isArray(parsedConfig)) {
        setStepError('El JSON no es válido. Debe ser un objeto.')
        return false
      }
    }

    if (stepToValidate === 4 && scheduleMode === 'cron') {
      if (!cron.trim()) {
        setStepError('Ingresa una expresión cron o selecciona ejecución manual.')
        return false
      }
    }

    return true
  }

  const validateAllSteps = () => {
    for (let step = 1; step < stepTitles.length; step += 1) {
      if (!validateStep(step)) {
        setCurrentStep(step)
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) return
    setCurrentStep((step) => Math.min(step + 1, stepTitles.length))
  }

  const handleBack = () => {
    setStepError('')
    setCurrentStep((step) => Math.max(step - 1, 1))
  }

  const buildPayload = () => {
    const schedule = scheduleMode === 'cron' ? cron.trim() || null : null
    const config = parsedConfig === null ? {} : parsedConfig

    return {
      name: name.trim(),
      source_entity: sourceEntity.trim(),
      connector_type: connectorType,
      config,
      schedule,
    }
  }

  const handleSubmit = () => {
    if (currentStep === stepTitles.length) {
      if (!validateAllSteps()) return
    } else if (!validateStep(currentStep)) {
      return
    }
    onSubmit(buildPayload())
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-600">
          {stepTitles.map((title, index) => (
            <span
              key={title}
              className={`rounded-full px-3 py-1 transition ${currentStep === index + 1 ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
            >
              {index + 1}. {title}
            </span>
          ))}
        </div>
      </div>

      {errorMessage ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{errorMessage}</p> : null}
      {stepError ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{stepError}</p> : null}

      {currentStep === 1 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="integration-name"
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
            placeholder="Por ejemplo: VTEX Pedidos Producción"
          />
          <Input
            id="integration-source-entity"
            label="Entidad fuente"
            value={sourceEntity}
            onChange={(event) => setSourceEntity(event.target.value)}
            error={fieldErrors.sourceEntity}
            placeholder="Por ejemplo: sales_order"
          />
        </div>
      ) : null}

      {currentStep === 2 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Selecciona el tipo de conector</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {connectorOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setConnectorType(option)}
                className={`rounded-3xl border p-4 text-left transition ${connectorType === option ? 'border-sky-600 bg-sky-50 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
              >
                <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-slate-900">{option}</span>
                <p className="mt-2 text-sm text-slate-500">
                  {option === 'api' && 'Conector REST/API.'}
                  {option === 'db' && 'Conector a base de datos.'}
                  {option === 'file' && 'Conector de archivos.'}
                  {option === 'webhook' && 'Recepción de eventos webhook.'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {currentStep === 3 ? (
        <ConnectorConfigForm
          connectorType={connectorType}
          configText={configText}
          setConfigText={setConfigText}
          error={stepError && currentStep === 3 ? stepError : undefined}
        />
      ) : null}

      {currentStep === 4 ? (
        <ScheduleEditor
          scheduleMode={scheduleMode}
          setScheduleMode={setScheduleMode}
          cron={cron}
          setCron={setCron}
          error={stepError && currentStep === 4 ? stepError : undefined}
        />
      ) : null}

      {currentStep === 5 ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Información básica</p>
              <p className="mt-3 text-sm text-slate-600">Nombre</p>
              <p className="mt-1 text-sm text-slate-900">{name || '—'}</p>
              <p className="mt-3 text-sm text-slate-600">Entidad fuente</p>
              <p className="mt-1 text-sm text-slate-900">{sourceEntity || '—'}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Conector</p>
              <p className="mt-3 text-sm text-slate-600">Tipo</p>
              <p className="mt-1 text-sm text-slate-900">{connectorType || '—'}</p>
              <p className="mt-3 text-sm text-slate-600">Programación</p>
              <p className="mt-1 text-sm text-slate-900">{scheduleMode === 'cron' ? cron || '—' : 'Manual'}</p>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-900">Configuración del conector</p>
              {connectorType ? <Badge variant="pending">{connectorType}</Badge> : null}
            </div>
            <pre className="mt-3 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">{configText || '{}'}</pre>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="text-sm text-slate-500">
          Paso {currentStep} de {stepTitles.length}
        </div>
        <div className="flex flex-wrap gap-3">
          {currentStep > 1 ? (
            <Button variant="outline" onClick={handleBack} disabled={loading}>
              Atrás
            </Button>
          ) : null}
          {currentStep < stepTitles.length ? (
            <Button onClick={handleNext} loading={loading}>
              Siguiente
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={loading}>
              {mode === 'create' ? 'Crear integración' : 'Guardar cambios'}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

export default IntegrationForm
