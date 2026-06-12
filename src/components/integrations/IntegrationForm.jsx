import { useEffect, useMemo, useState } from 'react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import ConnectorConfigForm from './ConnectorConfigForm'
import FieldMappingBuilder from './FieldMappingBuilder'
import ScheduleBuilder from './ScheduleBuilder'
import { SYSTEM_CATALOG, ENTITY_CATALOG, DESTINATION_SYSTEMS, getSystem, getEntity, getConnectorSchema } from '../../constants/connectors'
import { getScheduleDescription } from '../../utils/scheduleUtils'

/**
 * Business-oriented integration wizard
 * Translates user-friendly inputs to backend API contract
 * 
 * Wizard flow:
 * 1. Integration information (name, description)
 * 2. Source system selection
 * 3. Entity to sync
 * 4. Destination system
 * 5. Connection configuration (connector-specific forms)
 * 6. Field mapping (business-friendly mappings)
 * 7. Schedule (friendly presets, hide cron by default)
 * 8. Review and publish
 * 
 * TODO: Phase 2 - Add lookup table attachment step
 * TODO: Phase 2 - Add orchestration/trigger configuration
 */

const stepTitles = [
  'Integration Info',
  'Source System',
  'Entity to Sync',
  'Destination',
  'Connection Setup',
  'Field Mapping',
  'Schedule',
  'Review',
]

const IntegrationForm = ({ mode = 'create', defaultValues = {}, onSubmit, onCancel, loading, errorMessage }) => {
  const [currentStep, setCurrentStep] = useState(1)

  // Step 1: Integration Info
  const [name, setName] = useState(defaultValues.name || '')
  const [description, setDescription] = useState(defaultValues.description || '')

  // Step 2: Source System
  const [sourceSystemId, setSourceSystemId] = useState(
    defaultValues.source_system_id || (defaultValues.connector_type ? SYSTEM_CATALOG.find((s) => s.connectorType === defaultValues.connector_type)?.id : '')
  )

  // Step 3: Entity
  const [entityId, setEntityId] = useState(defaultValues.entity_id || defaultValues.source_entity || '')

  // Step 4: Destination System
  const [destinationSystemId, setDestinationSystemId] = useState(defaultValues.destination_system_id || DESTINATION_SYSTEMS[0].id)

  // Step 5: Connection Configuration
  const [connectorConfig, setConnectorConfig] = useState(defaultValues.config || {})

  // Step 6: Field Mapping
  const [fieldMappings, setFieldMappings] = useState(defaultValues.config?.field_mappings || [])

  // Step 7: Schedule
  const [schedule, setSchedule] = useState(defaultValues.schedule || null)

  // UI state
  const [stepError, setStepError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const sourceSystem = useMemo(() => getSystem(sourceSystemId), [sourceSystemId])
  const entity = useMemo(() => getEntity(entityId), [entityId])
  const destinationSystem = useMemo(() => DESTINATION_SYSTEMS.find((s) => s.id === destinationSystemId), [destinationSystemId])
  const connectorSchema = useMemo(() => getConnectorSchema(sourceSystem?.connectorType), [sourceSystem])

  useEffect(() => {
    setConnectorConfig({})
  }, [sourceSystemId])

  useEffect(() => {
    setFieldMappings([])
  }, [entityId])

  const validateStep = (stepToValidate) => {
    setStepError('')
    setFieldErrors({})
    const errors = {}

    if (stepToValidate === 1) {
      if (!name.trim()) errors.name = 'Integration name is required'
      setFieldErrors(errors)
      return Object.keys(errors).length === 0
    }

    if (stepToValidate === 2) {
      if (!sourceSystemId) {
        setStepError('Please select a source system')
        return false
      }
    }

    if (stepToValidate === 3) {
      if (!entityId) {
        setStepError('Please select an entity to sync')
        return false
      }
    }

    if (stepToValidate === 4) {
      if (!destinationSystemId) {
        setStepError('Please select a destination system')
        return false
      }
    }

    if (stepToValidate === 5) {
      if (!connectorSchema) {
        setStepError('Please select a source system to configure')
        return false
      }

      const missingField = connectorSchema.fields.find((field) => {
        if (!field.required) return false
        const value = connectorConfig[field.id]
        const dependsOn = field.dependsOn
        if (dependsOn) {
          const dependencyValue = connectorConfig[dependsOn.field]
          if (dependencyValue !== dependsOn.value) return false
        }
        return value === undefined || value === '' || value === null
      })

      if (missingField) {
        setStepError(`Please complete the required field: ${missingField.label}`)
        return false
      }
    }

    if (stepToValidate === 6) {
      const invalidMapping = fieldMappings.find((mapping) => {
        if (!mapping.target_field) return true
        if (mapping.field_type === 'constant') {
          return !mapping.constant_value
        }
        return !mapping.source_field
      })

      if (invalidMapping) {
        setStepError('Please finish or remove incomplete field mappings before continuing.')
        return false
      }
    }

    // Step 7 validation is handled by ScheduleBuilder
    // Step 8 is review only

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

  /**
   * Build API payload compatible with backend
   * Translates business-friendly inputs to technical format
   */
  const buildPayload = () => {
    const payloadConfig = { ...connectorConfig }

    if (fieldMappings.length > 0) {
      payloadConfig.field_mappings = fieldMappings.map((mapping) => ({
        source_field: mapping.source_field,
        target_field: mapping.target_field,
        field_type: mapping.field_type,
        constant_value: mapping.constant_value,
        on_error: mapping.on_error || 'fail',
      }))
    }

    return {
      name: name.trim(),
      // Use source_entity to maintain API compatibility
      source_entity: entity?.id || entityId,
      // Map system selection to connector_type for API
      connector_type: sourceSystem?.connectorType,
      // Pass connector config as-is (already built by ConnectorConfigForm)
      config: payloadConfig,
      // Pass schedule as cron string or null
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
        <div className="space-y-4">
          <div>
            <Input
              id="integration-name"
              label="Integration Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fieldErrors.name}
              placeholder="e.g., Sync Salesforce Orders"
              required
            />
          </div>
          <div>
            <Input
              id="integration-description"
              label="Description (Optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does this integration do?"
            />
          </div>
        </div>
      ) : null}

      {/* Step 2: Source System Selection */}
      {currentStep === 2 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Select the source system</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SYSTEM_CATALOG.map((system) => (
              <button
                key={system.id}
                type="button"
                onClick={() => setSourceSystemId(system.id)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  sourceSystemId === system.id
                    ? 'border-sky-600 bg-sky-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-2xl">{system.icon}</div>
                <p className="mt-2 font-semibold text-slate-900">{system.name}</p>
                <p className="mt-1 text-sm text-slate-600">{system.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 3: Entity Selection */}
      {currentStep === 3 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">What do you want to sync?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ENTITY_CATALOG.map((ent) => (
              <button
                key={ent.id}
                type="button"
                onClick={() => setEntityId(ent.id)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  entityId === ent.id ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-semibold text-slate-900">{ent.name}</p>
                <p className="mt-1 text-sm text-slate-600">{ent.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 4: Destination System */}
      {currentStep === 4 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-900">Where should the data go?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {DESTINATION_SYSTEMS.map((dest) => (
              <button
                key={dest.id}
                type="button"
                onClick={() => setDestinationSystemId(dest.id)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  destinationSystemId === dest.id
                    ? 'border-sky-600 bg-sky-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-2xl">{dest.icon}</div>
                <p className="mt-2 font-semibold text-slate-900">{dest.name}</p>
                <p className="mt-1 text-sm text-slate-600">{dest.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Step 5: Connection Configuration */}
      {currentStep === 5 ? (
        <ConnectorConfigForm
          connectorType={sourceSystem?.connectorType}
          sourceSystemName={sourceSystem?.name}
          config={connectorConfig}
          setConfig={setConnectorConfig}
          error={stepError}
        />
      ) : null}

      {/* Step 6: Field Mapping */}
      {currentStep === 6 ? (
        <FieldMappingBuilder entityId={entityId} fieldMappings={fieldMappings} setFieldMappings={setFieldMappings} />
      ) : null}

      {/* Step 7: Schedule */}
      {currentStep === 7 ? (
        <ScheduleBuilder schedule={schedule} setSchedule={setSchedule} error={stepError} />
      ) : null}

      {/* Step 8: Review */}
      {currentStep === 8 ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">Integration Name</p>
              <p className="mt-2 text-sm text-slate-600">{name}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">Source System</p>
              <p className="mt-2 text-sm text-slate-600">{sourceSystem?.name}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">Entity</p>
              <p className="mt-2 text-sm text-slate-600">{entity?.name}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold text-slate-900">Destination</p>
              <p className="mt-2 text-sm text-slate-600">{destinationSystem?.name}</p>
            </Card>
            <Card className="p-5 sm:col-span-2">
              <p className="text-sm font-semibold text-slate-900">Schedule</p>
              <p className="mt-2 text-sm text-slate-600">{getScheduleDescription(schedule)}</p>
            </Card>
            {fieldMappings.length > 0 ? (
              <Card className="p-5 sm:col-span-2">
                <p className="text-sm font-semibold text-slate-900">Field Mapping</p>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {fieldMappings.map((mapping, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="font-medium text-slate-900">{mapping.target_field || 'Target field'}</p>
                      <p>
                        {mapping.field_type === 'constant'
                          ? `Constant: ${mapping.constant_value || '—'}`
                          : `Source: ${mapping.source_field || '—'}`}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <details className="rounded-2xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-semibold text-slate-900">Technical Details</summary>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                <strong>Connector Type:</strong> {sourceSystem?.connectorType}
              </p>
              <p>
                <strong>Entity ID:</strong> {entityId}
              </p>
              {Object.keys(connectorConfig).length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-slate-700">Configuration Object</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                    {JSON.stringify(connectorConfig, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          </details>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="text-sm text-slate-500">
          Step {currentStep} of {stepTitles.length}
        </div>
        <div className="flex flex-wrap gap-3">
          {currentStep > 1 ? (
            <Button variant="outline" onClick={handleBack} disabled={loading}>
              Back
            </Button>
          ) : null}
          {currentStep < stepTitles.length ? (
            <Button onClick={handleNext} loading={loading}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={loading}>
              {mode === 'create' ? 'Create Integration' : 'Save Changes'}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export default IntegrationForm
