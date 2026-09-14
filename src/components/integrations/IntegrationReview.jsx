import { ArrowRight } from 'lucide-react'
import { getSafeIntegrationReviewConfig } from '../../services/adapters/integrationReviewAdapter'
import { getScheduleDescription } from '../../utils/scheduleUtils'
import MappingProfileReadOnly from './MappingProfileReadOnly'

const ReviewItem = ({ label, value, detail }) => (
  <div className="border-b border-slate-200 py-3 last:border-b-0">
    <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
      {value || 'Sin definir'}
    </dd>
    {detail ? <p className="mt-1 break-words text-xs text-slate-500">{detail}</p> : null}
  </div>
)

const ReviewSectionHeader = ({ eyebrow, title, description, status }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{eyebrow}</p>
      <h4 className="mt-1 text-lg font-semibold text-slate-900">{title}</h4>
      {description ? (
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      ) : null}
    </div>
    {status ? (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        {status}
      </span>
    ) : null}
  </div>
)

const getProfilesStatus = (profiles, loading) => {
  if (loading) return 'Consultando perfiles'
  if (!Array.isArray(profiles) || profiles.length === 0) return 'Requisito pendiente'
  if (profiles.length === 1) return '1 perfil compatible'
  return `${profiles.length} perfiles compatibles`
}

const FlowSummary = ({ sourceLabel, entity, destinationLabel }) => {
  const stages = [
    { label: sourceLabel || 'Sistema de origen', detail: 'Origen' },
    { label: 'Entrada → Canónico', detail: 'MappingProfile inbound' },
    { label: entity ? `${entity} canónico` : 'Entidad canónica', detail: 'M-Connect' },
    { label: 'Canónico → Destino', detail: 'MappingProfile outbound' },
    { label: destinationLabel, detail: 'Finnegans' },
  ]

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex min-w-[820px] items-stretch p-2">
        {stages.map((stage, index) => (
          <div key={stage.detail} className="contents">
            <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-4 text-center">
              <p className="truncate text-xs font-semibold text-slate-900">{stage.label}</p>
              <p className="mt-1 text-[11px] text-slate-500">{stage.detail}</p>
            </div>
            {index < stages.length - 1 ? (
              <div className="flex w-8 shrink-0 items-center justify-center text-slate-400">
                <ArrowRight size={15} aria-hidden="true" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
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
  const destinationLabel = finnegansDocumentLabel
    ? `Finnegans ${finnegansDocumentLabel}`
    : 'Finnegans'
  const safeConfigEntries = Object.keys(safeConfig)

  return (
    <div className="mt-6 space-y-8">
      <FlowSummary
        sourceLabel={sourceSystemLabel || sourceSystemId}
        entity={entity}
        destinationLabel={destinationLabel}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <ReviewSectionHeader
          eyebrow="Integración"
          title="Resumen de la configuración"
          description="Datos generales y configuración source que se enviarán al guardar la IntegrationConfig."
        />

        <dl className="mt-5 grid gap-x-8 sm:grid-cols-2 xl:grid-cols-4">
          <ReviewItem label="Nombre" value={name} />
          <ReviewItem label="Estado" value={isActive ? 'Activa' : 'Inactiva'} />
          <ReviewItem
            label="Sistema de origen"
            value={sourceSystemLabel || sourceSystemId}
            detail={sourceSystemLabel && sourceSystemId ? sourceSystemId : null}
          />
          <ReviewItem
            label="Tipo de conector"
            value={connectorTypeLabel || connectorType}
            detail={connectorTypeLabel && connectorType ? connectorType : null}
          />
          <ReviewItem
            label="Entidad"
            value={entity}
            detail={canonicalEntityLabel}
          />
          <ReviewItem label="Destino" value="Finnegans" />
          <ReviewItem
            label="Documento Finnegans"
            value={finnegansDocumentLabel || finnegansDocument || 'No aplica'}
            detail={finnegansDocumentLabel && finnegansDocument ? finnegansDocument : null}
          />
          <ReviewItem label="Programación" value={getScheduleDescription(schedule)} />
        </dl>

        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold text-slate-900">Configuración source segura</h5>
              <p className="mt-1 text-xs text-slate-500">
                Los valores sensibles se indican como configurados, sin mostrar su contenido.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">Valores sensibles protegidos</span>
          </div>
          {safeConfigEntries.length > 0 ? (
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              {JSON.stringify(safeConfig, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No hay configuración source adicional para mostrar.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <ReviewSectionHeader
          eyebrow="Entrada → Canónico"
          title={`${sourceSystemLabel || sourceSystemId || 'Sistema de origen'} → ${entity || 'entidad'} canónico`}
          description="Resumen del MappingProfile inbound compartido que backend detectará automáticamente. El detalle visual permanece en el paso Entrada."
          status={getProfilesStatus(inboundProfiles, profilesLoading)}
        />
        <div className="mt-5">
          <MappingProfileReadOnly
            profiles={inboundProfiles}
            loading={profilesLoading}
            presentation="json-summary"
            emptyMessage="No existe un MappingProfile inbound activo compatible."
            emptyDescription={`Sistema: ${sourceSystemId || 'no definido'} · Entidad: ${entity || 'no definida'}. Debe crearse desde la sección Perfiles de mapeo.`}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <ReviewSectionHeader
          eyebrow="Canónico → Destino"
          title={`${entity || 'Entidad'} canónico → ${destinationLabel}`}
          description="Resumen del MappingProfile outbound compartido que backend detectará automáticamente. El detalle visual permanece en el paso Salida."
          status={getProfilesStatus(outboundProfiles, profilesLoading)}
        />
        <div className="mt-5">
          <MappingProfileReadOnly
            profiles={outboundProfiles}
            loading={profilesLoading}
            presentation="json-summary"
            emptyMessage="No existe un MappingProfile outbound activo compatible."
            emptyDescription={`Sistema: ${outboundSourceSystem || 'no definido'} · Entidad: ${entity || 'no definida'} · Documento: ${finnegansDocumentLabel || finnegansDocument || 'no definido'}. Debe crearse desde la sección Perfiles de mapeo.`}
          />
        </div>
      </section>

      <aside className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
        Esta vista representa las transformaciones configuradas. Los datos transformados reales se generan durante la ejecución.
      </aside>
    </div>
  )
}

export default IntegrationReview
