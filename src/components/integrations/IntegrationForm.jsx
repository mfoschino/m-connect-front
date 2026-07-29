import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  FileInput,
  FileOutput,
  Landmark,
  PlugZap,
  Save,
  Settings2,
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ConnectorConfigForm from './ConnectorConfigForm'
import FieldMappingBuilder from './FieldMappingBuilder'
import ScheduleBuilder from './ScheduleBuilder'
import {
  SYSTEM_CATALOG,
  getConnectorSchema,
  getEntityFieldSpec,
} from '../../constants/connectors'
import { getScheduleDescription } from '../../utils/scheduleUtils'
import {
  FINNEGANS_DOCUMENT_OPTIONS,
  buildBackendIntegrationPayload,
  getCanonicalEntityDesign,
  getOutboundProfileSourceSystem,
  isFinnegansDocumentConfigurable,
  isFinnegansSourceSystem,
  mapBackendIntegrationToDesign,
  normalizeFinnegansDocumentForEntity,
} from '../../services/adapters/integrationFlowAdapter'
import { getMappingValidationErrors } from '../../services/adapters/mappingAdapter'

const STEPS = [
  { title: 'Información general', shortTitle: 'General', icon: Settings2 },
  { title: 'Sistema origen', shortTitle: 'Origen', icon: PlugZap },
  { title: 'Mapeo de entrada', shortTitle: 'Entrada', icon: FileInput },
  { title: 'Formato canónico', shortTitle: 'Canónico', icon: Boxes },
  { title: 'Mapeo de salida', shortTitle: 'Salida', icon: FileOutput },
  { title: 'Destino Finnegans', shortTitle: 'Destino', icon: Landmark },
  { title: 'Revisión', shortTitle: 'Revisión', icon: CheckCircle2 },
]

const STEP_DESCRIPTIONS = {
  1: 'Definí el nombre, el estado y la programación de la integración.',
  2: 'Configurá el sistema que entrega los datos y la entidad que se va a procesar.',
  3: 'Transformá los datos del origen al formato canónico de M-Connect.',
  4: 'Revisá la entidad central que desacopla el origen del destino.',
  5: 'Relacioná el formato canónico con el perfil de salida de Finnegans.',
  6: 'Confirmá cómo queda configurado el destino Finnegans.',
  7: 'Confirmá el flujo y el payload compatible con la API actual.',
}

const getGenericSystemId = (connectorType) => connectorType

const isFinnegansCatalogSystem = (system) => (
  isFinnegansSourceSystem(system.id) || isFinnegansSourceSystem(system.name)
)

const buildSourceSystems = (connectorTypes, selectedSourceSystemId, selectedConnectorType) => {
  const systems = connectorTypes.flatMap((connector) => {
    const catalogSystems = SYSTEM_CATALOG.filter(
      (system) => system.connectorType === connector.value && !isFinnegansCatalogSystem(system),
    )

    if (catalogSystems.length > 0) return catalogSystems
    if (isFinnegansSourceSystem(connector.value) || isFinnegansSourceSystem(connector.label)) return []

    return [{
      id: getGenericSystemId(connector.value),
      name: connector.label,
      description: connector.description,
      connectorType: connector.value,
    }]
  })

  const uniqueSystems = [...new Map(systems.map((system) => [system.id, system])).values()]

  if (
    !selectedSourceSystemId
    || uniqueSystems.some((system) => system.id === selectedSourceSystemId)
  ) {
    return uniqueSystems
  }

  const catalogSystem = SYSTEM_CATALOG.find((system) => system.id === selectedSourceSystemId)
  const existingSystem = catalogSystem ?? {
    id: selectedSourceSystemId,
    name: selectedSourceSystemId,
    description: 'Valor existente de la integración',
    connectorType: selectedConnectorType,
  }

  return [
    ...uniqueSystems,
    {
      ...existingSystem,
      disabled: isFinnegansCatalogSystem(existingSystem),
      existing: true,
    },
  ]
}

const getProfileEntity = (profile) => profile.source_entity ?? profile.entity ?? ''
const getProfileActive = (profile) => profile.active ?? profile.is_active ?? true

const ProfileSuggestions = ({ profiles, emptyMessage }) => {
  if (profiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {profiles.map((profile) => (
        <div key={profile.id ?? profile.name} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {profile.name || `Perfil ${profile.id}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {profile.source_system} · {getProfileEntity(profile)}
              {profile.version ? ` · v${profile.version}` : ''}
            </p>
          </div>
          <span
            className={`shrink-0 text-xs font-semibold ${
              getProfileActive(profile) ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {getProfileActive(profile) ? 'Compatible' : 'Inactivo'}
          </span>
        </div>
      ))}
    </div>
  )
}

const FlowOverview = ({
  sourceSystemName,
  canonicalLabel,
  finnegansDocumentLabel,
  currentStep,
}) => {
  const stages = [
    {
      label: sourceSystemName || 'Sistema origen',
      detail: 'Origen',
      active: currentStep === 2,
    },
    {
      label: 'Mapeo de entrada',
      detail: 'Profile por convención',
      active: currentStep === 3,
    },
    {
      label: canonicalLabel,
      detail: 'M-Connect',
      active: currentStep === 4,
    },
    {
      label: 'Mapeo de salida',
      detail: 'Profile Finnegans',
      active: currentStep === 5,
    },
    {
      label: 'Finnegans',
      detail: finnegansDocumentLabel || 'Destino',
      active: currentStep === 6,
    },
  ]

  return (
    <div className="overflow-x-auto border-y border-slate-200 bg-slate-50">
      <div className="mx-auto flex min-w-[780px] items-stretch">
        {stages.map((stage, index) => (
          <div key={stage.detail} className="contents">
            <div
              className={`min-w-0 flex-1 border-b-2 px-3 py-3 text-center ${
                stage.active
                  ? 'border-sky-600 bg-white'
                  : 'border-transparent'
              }`}
            >
              <p className={`truncate text-xs font-semibold ${stage.active ? 'text-sky-700' : 'text-slate-800'}`}>
                {stage.label}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">{stage.detail}</p>
            </div>
            {index < stages.length - 1 ? (
              <div className="flex w-7 shrink-0 items-center justify-center text-slate-400">
                <ArrowRight size={15} aria-hidden="true" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

const ReviewItem = ({ label, value, detail }) => (
  <div className="border-b border-slate-200 py-3 last:border-b-0">
    <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 text-sm font-semibold text-slate-900">{value || 'Sin definir'}</dd>
    {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
  </div>
)

const IntegrationForm = ({
  mode = 'create',
  defaultValues = {},
  onSubmit,
  onCancel,
  loading,
  errorMessage,
  metadata = {},
  profiles = [],
}) => {
  const designValues = useMemo(
    () => mapBackendIntegrationToDesign(defaultValues),
    [defaultValues],
  )
  const {
    fieldTypes = [],
    commonConfigFields = [],
    fieldTypeConfigFields = {},
    onErrorStrategies = [],
    entityTypes = [],
    connectorTypes = [],
    loading: metadataLoading = false,
    error: metadataError = null,
  } = metadata

  const initialEntityId = designValues.source_entity || designValues.entity_id || ''
  const [currentStep, setCurrentStep] = useState(1)
  const [name, setName] = useState(designValues.name || '')
  const [isActive, setIsActive] = useState(designValues.is_active ?? true)
  const [schedule, setSchedule] = useState(designValues.schedule)
  const [sourceSystemId, setSourceSystemId] = useState(designValues.source_system_id || '')
  const [entityId, setEntityId] = useState(initialEntityId)
  const [connectorConfig, setConnectorConfig] = useState(designValues.config ?? {})
  const [fieldMappings, setFieldMappings] = useState(
    designValues.config?.field_mappings ?? [],
  )
  const [finnegansDocument, setFinnegansDocument] = useState(
    () => normalizeFinnegansDocumentForEntity(initialEntityId, designValues),
  )
  const [stepError, setStepError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const sourceSystems = useMemo(
    () => buildSourceSystems(connectorTypes, sourceSystemId, designValues.connector_type),
    [connectorTypes, designValues.connector_type, sourceSystemId],
  )
  const sourceSystem = useMemo(
    () => sourceSystems.find((system) => system.id === sourceSystemId) ?? null,
    [sourceSystemId, sourceSystems],
  )
  const connectorType = sourceSystem?.connectorType ?? designValues.connector_type ?? ''
  const connectorTypeOption = useMemo(
    () => connectorTypes.find((option) => option.value === connectorType),
    [connectorType, connectorTypes],
  )
  const connectorSchema = useMemo(
    () => getConnectorSchema(connectorType),
    [connectorType],
  )
  const entityOptions = useMemo(() => {
    if (!entityId || entityTypes.some((option) => option.value === entityId)) {
      return entityTypes
    }

    return [
      { value: entityId, label: `${entityId} (valor existente)` },
      ...entityTypes,
    ]
  }, [entityId, entityTypes])
  const entity = useMemo(
    () => entityOptions.find((option) => option.value === entityId) ?? null,
    [entityId, entityOptions],
  )
  const canonicalEntity = useMemo(
    () => getCanonicalEntityDesign(entityId, entityOptions),
    [entityId, entityOptions],
  )
  const canonicalFields = useMemo(
    () => getEntityFieldSpec(entityId).destinationFields,
    [entityId],
  )
  const isFinnegansDocumentEnabled = isFinnegansDocumentConfigurable(entityId)
  const finnegansDocumentOptions = useMemo(() => {
    if (
      !finnegansDocument
      || FINNEGANS_DOCUMENT_OPTIONS.some((option) => option.value === finnegansDocument)
    ) {
      return FINNEGANS_DOCUMENT_OPTIONS
    }

    return [
      {
        value: finnegansDocument,
        label: `${finnegansDocument} (valor existente)`,
        description: 'Documento guardado previamente en la integración.',
      },
      ...FINNEGANS_DOCUMENT_OPTIONS,
    ]
  }, [finnegansDocument])
  const selectedFinnegansDocument = useMemo(
    () => finnegansDocumentOptions.find((option) => option.value === finnegansDocument),
    [finnegansDocument, finnegansDocumentOptions],
  )
  const outboundSourceSystem = getOutboundProfileSourceSystem(finnegansDocument, entityId)

  const inboundProfiles = useMemo(
    () => profiles.filter((profile) => (
      profile.source_system === sourceSystemId
      && getProfileEntity(profile) === entityId
    )),
    [entityId, profiles, sourceSystemId],
  )
  const outboundProfiles = useMemo(
    () => profiles.filter((profile) => (
      profile.source_system === outboundSourceSystem
      && getProfileEntity(profile) === entityId
    )),
    [entityId, outboundSourceSystem, profiles],
  )

  const payloadPreview = useMemo(
    () => buildBackendIntegrationPayload({
      name,
      source_entity: entityId,
      connector_type: connectorType,
      source_system: sourceSystemId,
      config: connectorConfig,
      field_mappings: fieldMappings,
      finnegans_document: finnegansDocument,
      schedule,
      is_active: isActive,
    }),
    [
      connectorConfig,
      connectorType,
      entityId,
      fieldMappings,
      finnegansDocument,
      isActive,
      name,
      schedule,
      sourceSystemId,
    ],
  )

  const validateStep = (stepToValidate) => {
    setStepError('')
    setFieldErrors({})

    if (stepToValidate === 1) {
      if (!name.trim()) {
        setFieldErrors({ name: 'El nombre de la integración es obligatorio.' })
        return false
      }
    }

    if (stepToValidate === 2) {
      if (metadataLoading) {
        setStepError('La metadata de integraciones todavía se está cargando.')
        return false
      }
      if (metadataError) {
        setStepError(`No se pudo cargar la metadata de integraciones: ${metadataError}`)
        return false
      }
      if (!sourceSystem) {
        setStepError('Seleccioná un sistema origen.')
        return false
      }
      if (!entity) {
        setStepError('Seleccioná una entidad.')
        return false
      }
      if (!connectorSchema) {
        setStepError('El tipo de conector seleccionado no tiene configuración visual disponible.')
        return false
      }

      const missingField = connectorSchema.fields.find((field) => {
        if (!field.required) return false
        if (
          field.dependsOn
          && connectorConfig[field.dependsOn.field] !== field.dependsOn.value
        ) {
          return false
        }
        const value = connectorConfig[field.id]
        return value === undefined || value === '' || value === null
      })

      if (missingField) {
        setStepError(`Completá el campo obligatorio: ${missingField.label}.`)
        return false
      }
    }

    if (stepToValidate === 3) {
      const mappingErrors = getMappingValidationErrors(fieldMappings, {
        fieldTypes,
        onErrorStrategies,
        fieldTypeConfigFields,
      })

      if (mappingErrors.length > 0) {
        setStepError(mappingErrors[0])
        return false
      }
    }

    if (stepToValidate === 6 && isFinnegansDocumentEnabled && !finnegansDocument) {
      setStepError('Seleccioná el documento destino de Finnegans.')
      return false
    }

    return true
  }

  const validateAllSteps = () => {
    for (let step = 1; step < STEPS.length; step += 1) {
      if (!validateStep(step)) {
        setCurrentStep(step)
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) return
    setCurrentStep((step) => Math.min(step + 1, STEPS.length))
  }

  const handleBack = () => {
    setStepError('')
    setCurrentStep((step) => Math.max(step - 1, 1))
  }

  const handleSubmit = () => {
    if (!validateAllSteps()) return
    onSubmit(payloadPreview)
  }

  const handleSourceSystemSelect = (system) => {
    if (system.disabled) return
    setSourceSystemId(system.id)
  }

  const handleEntitySelect = (selectedEntityId) => {
    if (selectedEntityId === entityId) return
    setEntityId(selectedEntityId)
    setFieldMappings([])
    setFinnegansDocument((currentDocument) => (
      normalizeFinnegansDocumentForEntity(selectedEntityId, currentDocument)
    ))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white pt-5 sm:-mx-8 sm:-mt-8 sm:px-8">
        <div className="overflow-x-auto">
          <ol className="flex min-w-[760px] items-center gap-1 pb-4">
            {STEPS.map((step, index) => {
              const stepNumber = index + 1
              const isCurrent = currentStep === stepNumber
              const isComplete = currentStep > stepNumber
              const StepIcon = step.icon

              return (
                <li key={step.title} className="flex min-w-0 flex-1 items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                        isCurrent
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : isComplete
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {isComplete
                        ? <Check size={15} aria-hidden="true" />
                        : <StepIcon size={15} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-xs font-semibold ${isCurrent ? 'text-sky-700' : 'text-slate-700'}`}>
                        {step.shortTitle}
                      </p>
                      <p className="text-[11px] text-slate-400">{stepNumber} de {STEPS.length}</p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 ? (
                    <div className={`mx-2 h-px w-5 shrink-0 ${isComplete ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="sm:-mx-8">
        <FlowOverview
          sourceSystemName={sourceSystem?.name}
          canonicalLabel={canonicalEntity.label}
          finnegansDocumentLabel={selectedFinnegansDocument?.label}
          currentStep={currentStep}
        />
      </div>

      <div className="flex-1 py-7">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase text-sky-700">
            Paso {currentStep} de {STEPS.length}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">
            {STEPS[currentStep - 1].title}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{STEP_DESCRIPTIONS[currentStep]}</p>
        </div>

        <div className="space-y-4">
          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {metadataLoading ? (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              Cargando metadata de integraciones...
            </p>
          ) : null}
          {metadataError ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              No se pudo cargar la metadata de integraciones: {metadataError}
            </p>
          ) : null}
          {stepError ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {stepError}
            </p>
          ) : null}
        </div>

        {currentStep === 1 ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="space-y-6">
              <Input
                id="integration-name"
                label="Nombre de la integración"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={fieldErrors.name}
                placeholder="Ej. Pedidos de Salesforce a Finnegans"
                required
              />

              <div className="flex items-center justify-between gap-4 border-y border-slate-200 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Integración activa</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Define el estado que se enviará al guardar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  onClick={() => setIsActive((value) => !value)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    isActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                      isActive ? 'left-6' : 'left-1'
                    }`}
                  />
                  <span className="sr-only">{isActive ? 'Desactivar' : 'Activar'}</span>
                </button>
              </div>
            </div>

            <div className="border-l-0 border-slate-200 lg:border-l lg:pl-8">
              <div className="mb-4 flex items-center gap-2">
                <CalendarClock size={18} className="text-slate-500" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">Programación</p>
              </div>
              <ScheduleBuilder schedule={schedule} setSchedule={setSchedule} error={stepError} />
            </div>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="mt-6 space-y-8">
            <section>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Sistema externo</h4>
                  <p className="mt-1 text-sm text-slate-500">Finnegans se reserva como destino.</p>
                </div>
                {connectorType ? (
                  <span className="text-xs font-semibold text-slate-500">
                    Conector: {connectorTypeOption?.label ?? connectorType}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {sourceSystems.map((system) => (
                  <button
                    key={system.id}
                    type="button"
                    onClick={() => handleSourceSystemSelect(system)}
                    disabled={metadataLoading || Boolean(metadataError) || system.disabled}
                    className={`min-h-28 rounded-lg border p-4 text-left transition ${
                      sourceSystemId === system.id
                        ? 'border-sky-600 bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <PlugZap size={19} className="text-slate-500" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">{system.name}</p>
                    {system.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {system.description}
                      </p>
                    ) : null}
                    {system.disabled ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        No disponible como origen
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-slate-900">Entidad canónica</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {entityOptions.map((entityType) => (
                  <button
                    key={entityType.value}
                    type="button"
                    onClick={() => handleEntitySelect(entityType.value)}
                    disabled={metadataLoading || Boolean(metadataError)}
                    className={`min-h-20 rounded-lg border p-4 text-left transition ${
                      entityId === entityType.value
                        ? 'border-sky-600 bg-sky-50'
                        : 'border-slate-200 bg-white hover:border-slate-400'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{entityType.label}</p>
                    {entityType.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {entityType.description}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>

            {sourceSystem ? (
              <section className="border-t border-slate-200 pt-7">
                <ConnectorConfigForm
                  connectorType={connectorType}
                  sourceSystemName={sourceSystem.name}
                  config={connectorConfig}
                  setConfig={setConnectorConfig}
                  error={stepError}
                />
              </section>
            ) : null}
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="mt-6 space-y-7">
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  {sourceSystem?.name || 'Origen'} → {canonicalEntity.label}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Estas reglas definen la transformación desde el origen.
                </p>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-slate-500">Profiles sugeridos</p>
                  <span className="text-xs text-slate-400">{inboundProfiles.length} encontrados</span>
                </div>
                <ProfileSuggestions
                  profiles={inboundProfiles}
                  emptyMessage="No hay profiles activos o inactivos que coincidan con este sistema y entidad."
                />
              </div>
            </section>

            <section className="border-t border-slate-200 pt-7">
              <FieldMappingBuilder
                entityId={entityId}
                fieldMappings={fieldMappings}
                setFieldMappings={setFieldMappings}
                fieldTypes={fieldTypes}
                commonConfigFields={commonConfigFields}
                fieldTypeConfigFields={fieldTypeConfigFields}
                onErrorStrategies={onErrorStrategies}
                metadataLoading={metadataLoading}
                metadataError={metadataError}
              />
            </section>
          </div>
        ) : null}

        {currentStep === 4 ? (
          <div className="mt-6">
            <div className="mx-auto max-w-3xl border-y border-sky-200 bg-sky-50 px-6 py-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-sky-700">
                <Boxes size={23} aria-hidden="true" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase text-sky-700">Etapa fija</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-900">{canonicalEntity.label}</h4>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
                Esta entidad desacopla el sistema origen de Finnegans y se deriva de la entidad seleccionada.
              </p>
            </div>

            <section className="mx-auto mt-7 max-w-3xl">
              <h4 className="text-sm font-semibold text-slate-900">Campos canónicos disponibles</h4>
              {canonicalFields.length > 0 ? (
                <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                  {canonicalFields.map((field) => (
                    <div key={field.id} className="flex items-center gap-3 border-b border-slate-200 py-3">
                      <Circle size={8} className="fill-sky-600 text-sky-600" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{field.label}</p>
                        <p className="text-xs text-slate-500">{field.id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  La entidad se preservará, pero todavía no tiene un catálogo local de campos canónicos.
                </p>
              )}
            </section>
          </div>
        ) : null}

        {currentStep === 5 ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
            <section>
              <h4 className="text-sm font-semibold text-slate-900">
                {canonicalEntity.label} → Finnegans
              </h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Los profiles de salida se administran por separado. En esta etapa se sugieren por la convención
                de Finnegans y la entidad, sin guardar un ID en la integración.
              </p>
              <dl className="mt-5 border-y border-slate-200">
                <ReviewItem label="Entidad" value={entity?.label ?? entityId} />
                <ReviewItem
                  label="Convención de profile"
                  value={outboundSourceSystem || 'Sin convención para el valor existente'}
                  detail="Se usa para sugerir profiles compatibles; la relación sigue siendo visual."
                />
              </dl>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-500">Profiles sugeridos</p>
                <span className="text-xs text-slate-400">{outboundProfiles.length} encontrados</span>
              </div>
              <ProfileSuggestions
                profiles={outboundProfiles}
                emptyMessage="No hay profiles que coincidan con la convención de salida y esta entidad."
              />
            </section>
          </div>
        ) : null}

        {currentStep === 6 ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-r-0 border-slate-200 lg:border-r lg:pr-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
                <Landmark size={22} aria-hidden="true" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-slate-900">Finnegans</h4>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Destino principal del flujo. No requiere elegirlo como sistema externo ni se envía como campo top-level.
              </p>
            </div>

            {isFinnegansDocumentEnabled ? (
              <section>
                <h4 className="text-sm font-semibold text-slate-900">Documento destino</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {finnegansDocumentOptions.map((documentOption) => (
                    <button
                      key={documentOption.value}
                      type="button"
                      onClick={() => setFinnegansDocument(documentOption.value)}
                      className={`min-h-32 rounded-lg border p-5 text-left transition ${
                        finnegansDocument === documentOption.value
                          ? 'border-sky-600 bg-sky-50'
                          : 'border-slate-200 bg-white hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{documentOption.label}</p>
                        {finnegansDocument === documentOption.value ? (
                          <CheckCircle2 size={18} className="shrink-0 text-sky-700" aria-hidden="true" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{documentOption.description}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Esta selección queda incluida en la configuración de la integración.
                </p>
              </section>
            ) : (
              <section className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-6">
                <h4 className="text-sm font-semibold text-slate-900">Destino sin documento configurable</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Finnegans queda como destino fijo para esta entidad. No se guarda un documento Finnegans en la configuración.
                </p>
              </section>
            )}
          </div>
        ) : null}

        {currentStep === 7 ? (
          <div className="mt-6 grid min-w-0 gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
            <section className="min-w-0">
              <h4 className="text-sm font-semibold text-slate-900">Resumen del flujo</h4>
              <dl className="mt-2 border-y border-slate-200">
                <ReviewItem label="Nombre" value={name} />
                <ReviewItem label="Estado" value={isActive ? 'Activa' : 'Inactiva'} />
                <ReviewItem
                  label="Origen"
                  value={sourceSystem?.name ?? sourceSystemId}
                  detail={`${connectorTypeOption?.label ?? connectorType} · ${sourceSystemId}`}
                />
                <ReviewItem label="Entidad canónica" value={canonicalEntity.label} />
                <ReviewItem
                  label="Mapeo de entrada"
                  value={`${fieldMappings.length} reglas · ${inboundProfiles.length} profiles compatibles`}
                />
                <ReviewItem
                  label="Mapeo de salida"
                  value={`${outboundProfiles.length} profiles compatibles`}
                  detail={outboundSourceSystem || 'Convención de salida no reconocida'}
                />
                <ReviewItem
                  label="Destino"
                  value={
                    isFinnegansDocumentEnabled
                      ? `Finnegans · ${selectedFinnegansDocument?.label ?? finnegansDocument}`
                      : 'Finnegans'
                  }
                />
                <ReviewItem
                  label="Programación"
                  value={getScheduleDescription(schedule)}
                />
              </dl>
            </section>

            <section className="min-w-0">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-sm font-semibold text-slate-900">Payload final</h4>
                <span className="text-xs font-semibold text-emerald-700">Contrato actual</span>
              </div>
              <pre className="mt-3 max-h-[430px] max-w-full overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {JSON.stringify(payloadPreview, null, 2)}
              </pre>
            </section>
          </div>
        ) : null}
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white py-5 sm:-mx-8 sm:-mb-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <div className="flex items-center justify-end gap-3">
          {currentStep > 1 ? (
            <Button type="button" variant="outline" className="gap-2" onClick={handleBack}>
              <ArrowLeft size={16} aria-hidden="true" />
              Atrás
            </Button>
          ) : null}
          {currentStep < STEPS.length ? (
            <Button
              type="button"
              className="gap-2"
              onClick={handleNext}
              disabled={loading || metadataLoading || Boolean(metadataError)}
            >
              Continuar
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" className="gap-2" onClick={handleSubmit} loading={loading}>
              {mode === 'edit' ? <Save size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              {mode === 'edit' ? 'Guardar cambios' : 'Crear integración'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default IntegrationForm
