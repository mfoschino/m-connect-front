import { ArrowRight, Boxes } from 'lucide-react'
import { buildCanonicalFlowTrace } from '../../services/adapters/canonicalFlowAdapter'
import MappingProfileReadOnly from './MappingProfileReadOnly'

const FIELD_TYPE_LABELS = {
  simple: 'Simple',
  path: 'Ruta',
  constant: 'Constante',
  lookup: 'Lookup',
  expression: 'Expresión',
  datetime: 'Fecha y hora',
  table: 'Tabla',
  nested_object: 'Objeto anidado',
}

const formatValue = (value) => {
  if (value === undefined) return 'sin valor'
  if (typeof value === 'string') return JSON.stringify(value)

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const getProfileEntity = (profile = {}) => profile.entity ?? profile.source_entity ?? ''

const getProfileIdentity = (profile = {}) => [
  profile.source_system || 'Sistema no informado',
  getProfileEntity(profile) || 'Entidad no informada',
  profile.version || 'Sin versión',
].join(' · ')

const MappingAnnotations = ({ mapping }) => {
  const annotations = []

  if (mapping.lookupTableCode) annotations.push(`Lookup: ${mapping.lookupTableCode}`)
  if (mapping.expression) annotations.push(`Expresión: ${mapping.expression}`)
  if (mapping.sourceFormat) annotations.push(`Formato de origen: ${mapping.sourceFormat}`)
  if (mapping.targetFormat) annotations.push(`Formato de destino: ${mapping.targetFormat}`)
  if (mapping.defaultValue !== undefined) {
    annotations.push(`Valor por defecto: ${formatValue(mapping.defaultValue)}`)
  }
  if (mapping.onError) annotations.push(`Ante error: ${mapping.onError}`)

  if (annotations.length === 0) return null

  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-500">
      {annotations.map((annotation, index) => (
        <li key={`${annotation}-${index}`}>{annotation}</li>
      ))}
    </ul>
  )
}

const MappingSummary = ({ mapping }) => {
  const source = mapping.direction === 'inbound'
    ? mapping.fieldType === 'constant'
      ? `Constante ${formatValue(mapping.constantValue)}`
      : mapping.sourceField || (mapping.expression ? 'Expresión configurada' : 'Origen no informado')
    : mapping.canonicalPath

  return (
    <li className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-slate-900">
          {source}
          <span className="mx-2 text-slate-400" aria-hidden="true">→</span>
          {mapping.targetPath || mapping.targetField || 'Destino no informado'}
        </p>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {FIELD_TYPE_LABELS[mapping.fieldType] ?? mapping.fieldType ?? 'Sin tipo'}
        </span>
      </div>
      <MappingAnnotations mapping={mapping} />
    </li>
  )
}

const getFieldStatus = (field) => {
  if (field.producers.length > 0 && field.consumers.length > 0) return 'Producido y consumido'
  if (field.producers.length > 0) return 'Sólo producido'
  return 'Sólo consumido'
}

const BRANCH_KIND_LABELS = {
  paired: 'Rama inbound/outbound',
  producer: 'Rama inbound',
  consumer: 'Rama outbound',
}

const getBranchIdentity = (branch) => [
  branch.producer
    ? `Inbound: ${branch.producer.sourceField || 'origen no informado'} → ${branch.producer.targetField || 'destino no informado'}`
    : null,
  branch.consumer
    ? `Outbound: ${branch.consumer.sourceField || 'origen no informado'} → ${branch.consumer.targetPath || 'destino no informado'}`
    : null,
].filter(Boolean)

const CanonicalFieldNode = ({ field, depth = 0 }) => (
  <li className={depth > 0 ? 'border-l-2 border-sky-100 pl-4' : ''}>
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Campo canónico observado
          </p>
          <h5 className="mt-1 break-words font-mono text-sm font-semibold text-slate-900">
            {field.canonicalPath}
          </h5>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {getFieldStatus(field)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section>
          <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Producido por el mapping de entrada
          </h6>
          {field.producers.length > 0 ? (
            <ol className="mt-2 space-y-2">
              {field.producers.map((mapping, index) => (
                <MappingSummary key={`producer-${field.canonicalPath}-${index}`} mapping={mapping} />
              ))}
            </ol>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
              Sin producción inbound observada.
            </p>
          )}
        </section>

        <section>
          <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Consumido por el mapping de salida
          </h6>
          {field.consumers.length > 0 ? (
            <ol className="mt-2 space-y-2">
              {field.consumers.map((mapping, index) => (
                <MappingSummary key={`consumer-${field.canonicalPath}-${index}`} mapping={mapping} />
              ))}
            </ol>
          ) : (
            <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
              Sin consumo outbound observado.
            </p>
          )}
        </section>
      </div>
    </article>

    {field.branches.length > 0 ? (
      <div className="mt-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Ramas estructurales observadas dentro de {field.canonicalPath}
        </p>
        <div className="space-y-4">
          {field.branches.map((branch, branchIndex) => (
            <section
              key={`${field.canonicalPath}-branch-${branchIndex}`}
              className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-sky-800">
                    {BRANCH_KIND_LABELS[branch.kind] ?? 'Rama observada'}
                  </p>
                  {getBranchIdentity(branch).map((identity) => (
                    <p key={identity} className="mt-1 break-words text-xs text-slate-600">
                      {identity}
                    </p>
                  ))}
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {FIELD_TYPE_LABELS[branch.containerType]
                    ?? branch.containerType
                    ?? 'Sin tipo estructural'}
                </span>
              </div>

              {branch.children.length > 0 ? (
                <ol className="mt-3 space-y-3">
                  {branch.children.map((child, childIndex) => (
                    <CanonicalFieldNode
                      key={`${child.canonicalPath}-${childIndex}`}
                      field={child}
                      depth={depth + 1}
                    />
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Esta rama no expone campos canónicos hijos asociables.
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    ) : null}
  </li>
)

const FlowOverview = ({ sourceLabel, canonicalEntityLabel, destinationLabel }) => {
  const stages = [
    sourceLabel || 'Sistema de origen',
    canonicalEntityLabel || 'Datos intermedios M-Connect',
    destinationLabel || 'Sistema de destino',
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-3 text-xs font-medium text-slate-500">Flujo configurado en los MappingProfiles</p>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {stages.map((stage, index) => (
          <div key={`${stage}-${index}`} className="contents">
            <div className="min-w-0 flex-1 rounded-lg bg-white px-3 py-3 text-center">
              <p className="break-words text-xs font-semibold text-slate-900">{stage}</p>
            </div>
            {index < stages.length - 1 ? (
              <div className="flex shrink-0 items-center justify-center text-slate-400 sm:w-8">
                <ArrowRight size={15} className="rotate-90 sm:rotate-0" aria-hidden="true" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

const getTraceMetrics = (trace) => ({
  relatedCount: trace.fields.filter((field) => (
    field.producers.length > 0 && field.consumers.length > 0
  )).length,
  producedOnlyCount: trace.fields.filter((field) => (
    field.producers.length > 0 && field.consumers.length === 0
  )).length,
  consumedOnlyCount: trace.fields.filter((field) => (
    field.producers.length === 0 && field.consumers.length > 0
  )).length,
  outboundConstantsCount: trace.outboundConstants.length,
  unassociatedOutboundRulesCount: trace.unassociatedOutboundRules.length,
})

const TraceSummary = ({ trace }) => {
  const metrics = getTraceMetrics(trace)
  const hasExceptions = metrics.producedOnlyCount > 0
    || metrics.consumedOnlyCount > 0
    || metrics.unassociatedOutboundRulesCount > 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="Resumen de trazabilidad canónica">
      <p className="text-xs font-medium text-slate-500">
        Campos canónicos principales observados en estos perfiles
      </p>
      <p className="mt-3 text-sm text-slate-700">
        <span className="mr-2 text-2xl font-semibold text-sky-800">{metrics.relatedCount}</span>
        {metrics.relatedCount === 1
          ? ' campo relacionado entre entrada y salida'
          : ' campos relacionados entre entrada y salida'}
      </p>

      {hasExceptions ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-xs font-semibold text-amber-900">También se observa:</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {metrics.producedOnlyCount > 0 ? (
              <li>
                {metrics.producedOnlyCount}
                {metrics.producedOnlyCount === 1
                  ? ' campo sólo producido por entrada'
                  : ' campos sólo producidos por entrada'}
              </li>
            ) : null}
            {metrics.consumedOnlyCount > 0 ? (
              <li>
                {metrics.consumedOnlyCount}
                {metrics.consumedOnlyCount === 1
                  ? ' campo sólo consumido por salida'
                  : ' campos sólo consumidos por salida'}
              </li>
            ) : null}
            {metrics.unassociatedOutboundRulesCount > 0 ? (
              <li>
                {metrics.unassociatedOutboundRulesCount}
                {metrics.unassociatedOutboundRulesCount === 1
                  ? ' regla de salida sin consumo canónico identificable'
                  : ' reglas de salida sin consumo canónico identificable'}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-700">
        <span className="font-semibold">{metrics.outboundConstantsCount}</span>
        {metrics.outboundConstantsCount === 1
          ? ' valor agregado por la transformación de salida'
          : ' valores agregados por la transformación de salida'}
      </p>
    </section>
  )
}

const TraceDisclosure = ({ collapsed, children }) => (
  collapsed ? (
    <details className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-sky-800">
        Ver trazabilidad completa
      </summary>
      <div className="mt-5 space-y-6 border-t border-slate-100 pt-5">{children}</div>
    </details>
  ) : children
)

const ProfileReference = ({ eyebrow, profile }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">
      {getProfileIdentity(profile)}
    </p>
  </div>
)

const MissingProfile = ({ direction }) => {
  const message = `No existe un MappingProfile ${direction} compatible observado.`
  const guidance = direction === 'inbound'
    ? 'Sin ese perfil no se puede reconstruir la producción canónica observada de entrada.'
    : 'Sin ese perfil no se puede reconstruir el consumo canónico observado de salida.'

  return (
    <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      {message} {guidance} Revisá los MappingProfiles compatibles.
    </p>
  )
}

const AmbiguousProfiles = ({ inboundProfiles, outboundProfiles }) => (
  <div className="space-y-6">
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p className="font-semibold">Se detectaron múltiples perfiles compatibles.</p>
      <p className="mt-1 leading-6">
        Backend resuelve estos recursos implícitamente y frontend no puede determinar cuál se utilizará.
        Por ese motivo no se genera una trazabilidad combinada.
      </p>
    </div>

    <section>
      <h5 className="mb-3 text-sm font-semibold text-slate-900">Candidatos inbound</h5>
      <MappingProfileReadOnly
        profiles={inboundProfiles}
        presentation="json-summary"
        emptyMessage="No existe un MappingProfile inbound compatible observado."
        emptyDescription="No hay configuración inbound para relacionar."
      />
    </section>

    <section>
      <h5 className="mb-3 text-sm font-semibold text-slate-900">Candidatos outbound</h5>
      <MappingProfileReadOnly
        profiles={outboundProfiles}
        presentation="json-summary"
        emptyMessage="No existe un MappingProfile outbound compatible observado."
        emptyDescription="No hay configuración outbound para relacionar."
      />
    </section>
  </div>
)

const CanonicalFlowReadOnly = ({
  inboundProfiles = [],
  outboundProfiles = [],
  loading = false,
  sourceLabel,
  canonicalEntityLabel,
  destinationLabel,
}) => {
  const compatibleInboundProfiles = Array.isArray(inboundProfiles) ? inboundProfiles : []
  const compatibleOutboundProfiles = Array.isArray(outboundProfiles) ? outboundProfiles : []
  const hasAmbiguousProfiles = (
    compatibleInboundProfiles.length > 1 || compatibleOutboundProfiles.length > 1
  )
  const hasUniqueProfiles = (
    compatibleInboundProfiles.length === 1 && compatibleOutboundProfiles.length === 1
  )
  const inboundProfile = compatibleInboundProfiles.length === 1
    ? compatibleInboundProfiles[0]
    : undefined
  const outboundProfile = compatibleOutboundProfiles.length === 1
    ? compatibleOutboundProfiles[0]
    : undefined
  const trace = hasAmbiguousProfiles
    ? { fields: [], outboundConstants: [], unassociatedOutboundRules: [] }
    : buildCanonicalFlowTrace({ inboundProfile, outboundProfile })

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-start gap-4 rounded-xl border border-sky-200 bg-sky-50 px-5 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sky-700">
          <Boxes size={20} aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-lg font-semibold text-slate-900">Trazabilidad canónica</h4>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Esta vista representa la configuración observada en los MappingProfiles compatibles.
            No es un payload de ejecución ni el schema oficial de la entidad, ni una validación
            semántica completa.
          </p>
        </div>
      </div>

      {!loading && hasUniqueProfiles ? (
        <>
          <FlowOverview
            sourceLabel={sourceLabel}
            canonicalEntityLabel={canonicalEntityLabel}
            destinationLabel={destinationLabel}
          />
          <TraceSummary trace={trace} />
        </>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          Consultando perfiles de mapeo reales...
        </div>
      ) : hasAmbiguousProfiles ? (
        <AmbiguousProfiles
          inboundProfiles={compatibleInboundProfiles}
          outboundProfiles={compatibleOutboundProfiles}
        />
      ) : (
        <TraceDisclosure collapsed={hasUniqueProfiles}>
          <div className="grid gap-3 lg:grid-cols-2">
            {inboundProfile ? (
              <ProfileReference eyebrow="MappingProfile inbound" profile={inboundProfile} />
            ) : (
              <MissingProfile direction="inbound" />
            )}
            {outboundProfile ? (
              <ProfileReference eyebrow="MappingProfile outbound" profile={outboundProfile} />
            ) : (
              <MissingProfile direction="outbound" />
            )}
          </div>

          <section>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-slate-900">Campos canónicos observados</h5>
                <p className="mt-1 text-sm text-slate-500">
                  Relación exacta entre target_field inbound y source_field outbound.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {trace.fields.length} campos raíz observados
              </span>
            </div>

            {trace.fields.length > 0 ? (
              <ol className="mt-4 space-y-4">
                {trace.fields.map((field, index) => (
                  <CanonicalFieldNode key={`${field.canonicalPath}-${index}`} field={field} />
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                No hay campos canónicos observados en los perfiles compatibles actuales.
              </p>
            )}
          </section>

          {trace.outboundConstants.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h5 className="text-sm font-semibold text-slate-900">
                Valores agregados por el mapping de salida
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                Estas constantes no consumen campos canónicos observados.
              </p>
              <ul className="mt-4 space-y-2">
                {trace.outboundConstants.map((mapping, index) => (
                  <li
                    key={`${mapping.targetPath || mapping.targetField}-${index}`}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                  >
                    <p className="break-words text-sm font-medium text-slate-900">
                      {mapping.targetPath || mapping.targetField || 'Destino no informado'}
                      {' = '}
                      {formatValue(mapping.constantValue)}
                    </p>
                    <MappingAnnotations mapping={mapping} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {trace.unassociatedOutboundRules.length > 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
              <h5 className="text-sm font-semibold text-slate-900">
                Reglas de salida sin consumo canónico identificable
              </h5>
              <p className="mt-1 text-sm text-slate-500">
                Se conserva su configuración, pero no se infieren dependencias sin source_field.
              </p>
              <ul className="mt-4 space-y-2">
                {trace.unassociatedOutboundRules.map((mapping, index) => (
                  <li
                    key={`${mapping.targetPath || mapping.targetField}-${index}`}
                    className="rounded-lg border border-amber-200 bg-white px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="break-words text-sm font-medium text-slate-900">
                          {mapping.targetPath || mapping.targetField || 'Destino no informado'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Sin campo canónico source identificado.
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        {FIELD_TYPE_LABELS[mapping.fieldType]
                          ?? mapping.fieldType
                          ?? 'Sin tipo'}
                      </span>
                    </div>
                    <MappingAnnotations mapping={mapping} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </TraceDisclosure>
      )}
    </div>
  )
}

export default CanonicalFlowReadOnly
