import { ArrowRight } from 'lucide-react'
import { getSafeIntegrationReviewConfig } from '../../services/adapters/integrationReviewAdapter'
import { getScheduleDescription } from '../../utils/scheduleUtils'
import MappingProfileReadOnly from './MappingProfileReadOnly'

const ReviewItem = ({ label, value }) => (
  <div className="border-b border-slate-200 py-3 last:border-b-0">
    <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
      {value || 'Sin definir'}
    </dd>
  </div>
)

const getProfilesStatus = (profiles, loading) => {
  if (loading) return 'Consultando perfiles'
  if (!Array.isArray(profiles) || profiles.length === 0) return 'Requisito pendiente'
  if (profiles.length === 1) return 'Perfil compatible detectado automáticamente'
  return `${profiles.length} perfiles compatibles detectados`
}

const FlowSummary = ({ sourceLabel, destinationLabel }) => (
  <div className="mt-5 flex flex-col items-stretch gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
    <div className="min-w-0 flex-1 rounded-lg bg-white px-4 py-3 text-center">
      <p className="text-xs font-medium text-slate-500">Sistema de origen</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {sourceLabel || 'Sin definir'}
      </p>
    </div>
    <ArrowRight size={18} className="mx-auto shrink-0 rotate-90 text-slate-400 sm:rotate-0" aria-hidden="true" />
    <div className="min-w-0 flex-1 rounded-lg bg-white px-4 py-3 text-center">
      <p className="text-xs font-medium text-slate-500">Destino</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{destinationLabel}</p>
    </div>
  </div>
)

const ProfileReviewStatus = ({ direction, profiles, loading }) => {
  const compatibleProfiles = Array.isArray(profiles) ? profiles : []
  const needsAttention = !loading && compatibleProfiles.length !== 1
  const directionLabel = direction === 'inbound' ? 'Transformación de entrada' : 'Transformación de salida'

  return (
    <div className={`rounded-lg border px-4 py-4 ${
      needsAttention ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-slate-50'
    }`}>
      <h5 className="text-sm font-semibold text-slate-900">{directionLabel}</h5>
      <p className="mt-1 text-sm font-medium text-slate-700">
        {getProfilesStatus(compatibleProfiles, loading)}
      </p>
      {!loading && compatibleProfiles.length === 0 ? (
        <p className="mt-1 text-xs text-slate-600">No hay un MappingProfile activo compatible observado.</p>
      ) : !loading && compatibleProfiles.length > 1 ? (
        <p className="mt-1 text-xs text-slate-600">
          No se elige un perfil aquí; el backend resuelve estos candidatos compartidos.
        </p>
      ) : null}
    </div>
  )
}

const IntegrationReview = ({
  name,
  isActive,
  sourceSystemId,
  sourceSystemLabel,
  connectorType,
  connectorTypeLabel,
  entity,
  canonicalEntityLabel,
  finnegansDocument,
  finnegansDocumentLabel,
  schedule,
  config,
  inboundProfiles = [],
  outboundProfiles = [],
  profilesLoading = false,
  outboundSourceSystem,
}) => {
  const safeConfig = getSafeIntegrationReviewConfig(config)
  const safeConfigEntries = Object.keys(safeConfig)
  const destinationLabel = finnegansDocumentLabel
    ? `Finnegans ${finnegansDocumentLabel}`
    : 'Finnegans'

  return (
    <div className="mt-6 space-y-6">
      <header>
        <h4 className="text-lg font-semibold text-slate-900">Revisión de integración</h4>
        <p className="mt-1 text-sm text-slate-600">Confirmá la configuración antes de guardarla.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Se guardará</p>
        <h5 className="mt-2 break-words text-xl font-semibold text-slate-900">
          {name || 'Sin nombre'}
        </h5>
        <FlowSummary
          sourceLabel={sourceSystemLabel || sourceSystemId}
          destinationLabel={destinationLabel}
        />

        <dl className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          <ReviewItem label="Entidad" value={canonicalEntityLabel || entity} />
          <ReviewItem label="Tipo de conector" value={connectorTypeLabel || connectorType} />
          {finnegansDocument || finnegansDocumentLabel ? (
            <ReviewItem
              label="Documento Finnegans"
              value={finnegansDocumentLabel || finnegansDocument}
            />
          ) : null}
          <ReviewItem label="Estado" value={isActive ? 'Activa' : 'Inactiva'} />
          <ReviewItem label="Programación" value={getScheduleDescription(schedule)} />
          <ReviewItem
            label="Configuración de origen"
            value={safeConfigEntries.length > 0
              ? 'Configuración adicional incluida; valores sensibles protegidos'
              : 'Sin configuración adicional'}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
          Detectado automáticamente
        </p>
        <h4 className="mt-1 text-lg font-semibold text-slate-900">Transformaciones compatibles</h4>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Estos MappingProfiles se observan para la configuración actual; sus IDs no se guardan en la integración.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ProfileReviewStatus direction="inbound" profiles={inboundProfiles} loading={profilesLoading} />
          <ProfileReviewStatus direction="outbound" profiles={outboundProfiles} loading={profilesLoading} />
        </div>
      </section>

      <details className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <summary className="cursor-pointer text-sm font-semibold text-sky-800">
          Ver detalles técnicos
        </summary>
        <div className="mt-5 space-y-7 border-t border-slate-200 pt-5">
          <section>
            <h5 className="text-sm font-semibold text-slate-900">Identificadores de configuración</h5>
            <dl className="mt-2 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
              <ReviewItem label="source_system" value={sourceSystemId} />
              <ReviewItem label="entity" value={entity} />
              <ReviewItem label="connector_type" value={connectorType} />
              {finnegansDocument ? (
                <ReviewItem label="finnegans_document" value={finnegansDocument} />
              ) : null}
            </dl>
          </section>

          <section>
            <h5 className="text-sm font-semibold text-slate-900">Configuración source segura</h5>
            <p className="mt-1 text-xs text-slate-500">
              Valores sensibles protegidos: se indica que están configurados sin mostrar su contenido.
            </p>
            {safeConfigEntries.length > 0 ? (
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {JSON.stringify(safeConfig, null, 2)}
              </pre>
            ) : (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No hay configuración source adicional para mostrar.
              </p>
            )}
          </section>

          <section>
            <h5 className="mb-3 text-sm font-semibold text-slate-900">MappingProfile inbound</h5>
            <MappingProfileReadOnly
              profiles={inboundProfiles}
              loading={profilesLoading}
              presentation="json-summary"
              emptyMessage="No existe un MappingProfile inbound activo compatible."
              emptyDescription={`Sistema: ${sourceSystemId || 'no definido'} · Entidad: ${entity || 'no definida'}. Debe crearse desde la sección Perfiles de mapeo.`}
            />
          </section>

          <section>
            <h5 className="mb-3 text-sm font-semibold text-slate-900">MappingProfile outbound</h5>
            <MappingProfileReadOnly
              profiles={outboundProfiles}
              loading={profilesLoading}
              presentation="json-summary"
              emptyMessage="No existe un MappingProfile outbound activo compatible."
              emptyDescription={`Sistema: ${outboundSourceSystem || 'no definido'} · Entidad: ${entity || 'no definida'} · Documento: ${finnegansDocumentLabel || finnegansDocument || 'no definido'}. Debe crearse desde la sección Perfiles de mapeo.`}
            />
          </section>
        </div>
      </details>

      <aside className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
        Esta vista representa las transformaciones configuradas. Los datos transformados reales se generan durante la ejecución.
      </aside>
    </div>
  )
}

export default IntegrationReview
