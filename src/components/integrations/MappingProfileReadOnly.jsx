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

const getProfileEntity = (profile = {}) => profile.source_entity ?? profile.entity ?? ''

const getProfileStatus = (profile = {}) => (
  (profile.is_active ?? profile.active) === true ? 'Activo' : 'Inactivo'
)

const getProfileMappings = (profile = {}) => (
  Array.isArray(profile.config) ? profile.config : []
)

const formatValue = (value) => {
  if (value === undefined) return 'sin valor'
  if (typeof value === 'string') return JSON.stringify(value)

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const getMappingSource = (mapping = {}) => {
  if (mapping.field_type === 'constant') {
    return `Constante ${formatValue(mapping.constant_value ?? mapping.value)}`
  }

  if (mapping.source_field) return mapping.source_field
  if (mapping.field_type === 'expression') return 'Expresión'
  return 'Origen no definido'
}

const MappingDetails = ({ mapping }) => {
  const lookupTableCode = mapping.lookup_table_code ?? mapping.lookup_table_name
  const details = []

  if (lookupTableCode) details.push(`Lookup: ${lookupTableCode}`)
  if (mapping.expression) details.push(`Expresión: ${mapping.expression}`)
  if (mapping.source_format) details.push(`Formato de origen: ${mapping.source_format}`)
  if (mapping.target_format) details.push(`Formato de destino: ${mapping.target_format}`)
  if (mapping.default_value !== undefined) {
    details.push(`Valor por defecto: ${formatValue(mapping.default_value)}`)
  }
  if (mapping.on_error) details.push(`Ante error: ${mapping.on_error}`)

  if (details.length === 0) return null

  return (
    <ul className="mt-2 space-y-1 text-xs text-slate-500">
      {details.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}
    </ul>
  )
}

const MappingItem = ({ mapping, depth }) => {
  const subMappings = Array.isArray(mapping.sub_mappings) ? mapping.sub_mappings : []
  const fieldTypeLabel = FIELD_TYPE_LABELS[mapping.field_type] ?? mapping.field_type ?? 'Sin tipo'

  return (
    <li>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-medium text-slate-900">
            {getMappingSource(mapping)}
            <span className="mx-2 text-slate-400" aria-hidden="true">→</span>
            {mapping.target_field || 'Destino no definido'}
          </p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {fieldTypeLabel}
          </span>
        </div>
        <MappingDetails mapping={mapping} />
      </div>

      {subMappings.length > 0 ? (
        <div className="ml-4 mt-2 border-l-2 border-sky-100 pl-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Mapeos anidados
          </p>
          <MappingList mappings={subMappings} depth={depth + 1} />
        </div>
      ) : null}
    </li>
  )
}

export const MappingList = ({ mappings = [], depth = 0 }) => {
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        El perfil no contiene mappings configurados.
      </p>
    )
  }

  return (
    <ol className={`space-y-2 ${depth > 0 ? 'mt-0' : ''}`}>
      {mappings.map((mapping, index) => (
        <MappingItem
          key={`${mapping?.target_field ?? mapping?.source_field ?? 'mapping'}-${index}`}
          mapping={mapping ?? {}}
          depth={depth}
        />
      ))}
    </ol>
  )
}

const ProfileCard = ({ profile, index, showCandidateLabel, presentation }) => {
  const mappings = getProfileMappings(profile)
  const showJsonSummary = presentation === 'json-summary'

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            {showCandidateLabel ? `Candidato ${index + 1}` : 'Transformación configurada'}
          </p>
          <h5 className="mt-1 text-base font-semibold text-slate-900">
            {profile.source_system || 'Sistema no informado'} → {getProfileEntity(profile) || 'Entidad no informada'}
          </h5>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
          {getProfileStatus(profile)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Source system</dt>
          <dd className="mt-1 break-words text-slate-900">{profile.source_system || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Entity</dt>
          <dd className="mt-1 break-words text-slate-900">{getProfileEntity(profile) || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Versión</dt>
          <dd className="mt-1 break-words text-slate-900">{profile.version || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase text-slate-500">Mappings</dt>
          <dd className="mt-1 text-slate-900">{mappings.length}</dd>
        </div>
        {profile.id ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-xs font-semibold uppercase text-slate-500">ID</dt>
            <dd className="mt-1 break-all font-mono text-xs text-slate-700">{profile.id}</dd>
          </div>
        ) : null}
      </dl>

      {showJsonSummary ? (
        <div className="mt-5 border-t border-slate-200 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Configuración JSON del MappingProfile
          </p>
          <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            {JSON.stringify(mappings, null, 2)}
          </pre>
        </div>
      ) : (
        <>
          <div className="mt-5 border-t border-slate-200 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Perfil de mapeo
            </p>
            <MappingList mappings={mappings} />
          </div>

          <details className="mt-4 border-t border-slate-200 pt-4">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Ver configuración JSON del perfil
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
              {JSON.stringify(mappings, null, 2)}
            </pre>
          </details>
        </>
      )}
    </article>
  )
}

const MappingProfileReadOnly = ({
  profiles = [],
  loading = false,
  emptyMessage,
  emptyDescription,
  presentation = 'detailed',
}) => {
  const compatibleProfiles = Array.isArray(profiles) ? profiles : []

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
        Consultando perfiles de mapeo reales...
      </div>
    )
  }

  if (compatibleProfiles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-5 text-sm text-amber-900">
        <p className="font-semibold">{emptyMessage}</p>
        <p className="mt-2 leading-6">{emptyDescription}</p>
      </div>
    )
  }

  const hasMultipleProfiles = compatibleProfiles.length > 1

  return (
    <div className="space-y-4">
      {hasMultipleProfiles ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <p className="font-semibold">Se encontraron múltiples MappingProfiles activos compatibles.</p>
          <p className="mt-1 leading-6">
            La IntegrationConfig actual no permite seleccionar uno explícitamente. Backend determinará cuál resolver durante la ejecución.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Perfil detectado automáticamente
        </div>
      )}

      {compatibleProfiles.map((profile, index) => (
        <ProfileCard
          key={profile.id ?? `${profile.source_system}-${getProfileEntity(profile)}-${profile.version}-${index}`}
          profile={profile}
          index={index}
          showCandidateLabel={hasMultipleProfiles}
          presentation={presentation}
        />
      ))}
    </div>
  )
}

export default MappingProfileReadOnly
