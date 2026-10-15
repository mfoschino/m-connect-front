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

const HUMAN_FIELD_TYPE_LABELS = {
  constant: 'Valor fijo',
  lookup: 'Tabla de conversión',
  expression: 'Cálculo configurado',
  datetime: 'Conversión de fecha',
}

const getProfileEntity = (profile = {}) => profile.source_entity ?? profile.entity ?? ''

const getProfileStatus = (profile = {}) => (
  (profile.is_active ?? profile.active) === true ? 'Activo' : 'Inactivo'
)

const getProfileMappings = (profile = {}) => (
  Array.isArray(profile.config) ? profile.config : []
)

const getRuleCountLabel = (count) => (
  `${count} ${count === 1 ? 'regla principal configurada' : 'reglas principales configuradas'}`
)

const getConstantValue = (mapping) => (
  Object.hasOwn(mapping, 'constant_value') ? mapping.constant_value : mapping.value
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

const MappingDetails = ({ mapping, humanized = false }) => {
  const lookupTableCode = mapping.lookup_table_code ?? mapping.lookup_table_name
  const details = []

  if (humanized && mapping.field_type === 'expression' && mapping.source_field) {
    details.push(`Origen declarado: ${mapping.source_field}`)
  }
  if (lookupTableCode) details.push(`${humanized ? 'Tabla de conversión' : 'Lookup'}: ${lookupTableCode}`)
  if (mapping.expression) details.push(`${humanized ? 'Cálculo configurado' : 'Expresión'}: ${mapping.expression}`)
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

const MappingItem = ({ mapping, depth, humanized = false }) => {
  const subMappings = Array.isArray(mapping.sub_mappings) ? mapping.sub_mappings : []
  const fieldTypeLabel = FIELD_TYPE_LABELS[mapping.field_type] ?? mapping.field_type ?? 'Sin tipo'
  const displayTypeLabel = humanized
    ? HUMAN_FIELD_TYPE_LABELS[mapping.field_type] ?? fieldTypeLabel
    : fieldTypeLabel
  const isConstant = humanized && mapping.field_type === 'constant'
  const isExpression = humanized && mapping.field_type === 'expression'

  return (
    <li>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 break-words text-sm font-medium text-slate-900">
            {isConstant ? (
              <>
                {mapping.target_field || 'Destino no definido'}
                <span className="mx-2 text-slate-400" aria-hidden="true">=</span>
                {formatValue(getConstantValue(mapping))}
              </>
            ) : isExpression ? (
              mapping.target_field || 'Destino no definido'
            ) : (
              <>
                {getMappingSource(mapping)}
                <span className="mx-2 text-slate-400" aria-hidden="true">→</span>
                {mapping.target_field || 'Destino no definido'}
              </>
            )}
          </p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {displayTypeLabel}
          </span>
        </div>
        {humanized && (mapping.field_type === 'table' || mapping.field_type === 'nested_object') ? (
          <p className="mt-2 text-xs text-slate-500">
            {subMappings.length} {subMappings.length === 1 ? 'regla interna' : 'reglas internas'}
          </p>
        ) : null}
        <MappingDetails mapping={mapping} humanized={humanized} />
      </div>

      {subMappings.length > 0 ? (
        <div className="ml-4 mt-2 border-l-2 border-sky-100 pl-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {humanized ? 'Reglas internas' : 'Mapeos anidados'}
          </p>
          <MappingList mappings={subMappings} depth={depth + 1} humanized={humanized} />
        </div>
      ) : null}
    </li>
  )
}

export const MappingList = ({ mappings = [], depth = 0, humanized = false }) => {
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
          humanized={humanized}
        />
      ))}
    </ol>
  )
}

const ProfileMetadata = ({ profile, mappingCount }) => (
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
      <dd className="mt-1 text-slate-900">{mappingCount}</dd>
    </div>
    {profile.id ? (
      <div className="sm:col-span-2 lg:col-span-4">
        <dt className="text-xs font-semibold uppercase text-slate-500">ID</dt>
        <dd className="mt-1 break-all font-mono text-xs text-slate-700">{profile.id}</dd>
      </div>
    ) : null}
  </dl>
)

const ProfileCard = ({ profile, index, showCandidateLabel, presentation }) => {
  const mappings = getProfileMappings(profile)
  const showJsonSummary = presentation === 'json-summary'

  if (presentation === 'wizard') {
    return (
      <article className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        {showCandidateLabel ? (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perfil compatible</p>
            <h5 className="mt-1 break-words text-sm font-semibold text-slate-900">
              {profile.source_system || 'Sistema no informado'} · {getProfileEntity(profile) || 'Entidad no informada'} · Versión {profile.version || '—'}
            </h5>
            <p className="mt-1 text-xs text-slate-600">{getRuleCountLabel(mappings.length)}</p>
          </div>
        ) : null}

        <details>
          <summary className="cursor-pointer text-sm font-semibold text-sky-700">Ver reglas</summary>
          <div className="mt-4">
            <MappingList mappings={mappings} humanized />
          </div>
        </details>

        <details className="mt-4 border-t border-slate-200 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Ver detalles técnicos</summary>
          <ProfileMetadata profile={profile} mappingCount={mappings.length} />
          <p className="mb-3 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Configuración JSON del MappingProfile
          </p>
          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            {JSON.stringify(mappings, null, 2)}
          </pre>
        </details>
      </article>
    )
  }

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

      <ProfileMetadata profile={profile} mappingCount={mappings.length} />

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
  wizardContext = {},
}) => {
  const compatibleProfiles = Array.isArray(profiles) ? profiles : []

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
        Consultando perfiles de mapeo reales...
      </div>
    )
  }

  if (presentation === 'wizard') {
    const directionLabel = wizardContext.direction === 'outbound'
      ? 'Transformación de salida'
      : 'Transformación de entrada'
    const fromLabel = wizardContext.fromLabel || 'Origen'
    const toLabel = wizardContext.toLabel || 'Destino'
    const systemLabel = wizardContext.matchSystemLabel || wizardContext.matchSystemCode || 'no definido'
    const systemCode = wizardContext.matchSystemCode
    const systemIdentity = systemCode && systemCode !== systemLabel
      ? `${systemLabel} (${systemCode})`
      : systemLabel

    if (compatibleProfiles.length === 0) {
      return (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-5 text-amber-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{directionLabel} · Requisito pendiente</p>
          <h4 className="mt-2 text-base font-semibold">No se encontró un MappingProfile activo compatible</h4>
          <p className="mt-2 text-sm">Sistema: {systemIdentity} · Entidad: {wizardContext.entity || 'no definida'}</p>
          <p className="mt-3 text-sm leading-6">
            Esta integración no guarda una selección manual de perfil. Revisá los Perfiles de mapeo compatibles para esta combinación.
          </p>
        </section>
      )
    }

    const hasMultipleProfiles = compatibleProfiles.length > 1

    return (
      <div className="space-y-4">
        <section className={`rounded-xl border px-5 py-5 ${
          hasMultipleProfiles
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-emerald-200 bg-emerald-50 text-emerald-950'
        }`}>
          <p className="text-xs font-semibold uppercase tracking-wide">{directionLabel}</p>
          <h4 className="mt-2 text-base font-semibold">
            {hasMultipleProfiles
              ? `Se encontraron ${compatibleProfiles.length} MappingProfiles activos compatibles`
              : 'Transformación detectada automáticamente'}
          </h4>
          <p className="mt-2 break-words text-sm font-medium">{fromLabel} → {toLabel}</p>
          {hasMultipleProfiles ? (
            <p className="mt-3 text-sm leading-6">
              Esta integración no guarda una selección de perfil. La resolución de estos recursos compartidos corresponde al backend.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm">{getRuleCountLabel(getProfileMappings(compatibleProfiles[0]).length)}</p>
              <p className="mt-3 text-sm leading-6">
                Este perfil coincide con el sistema, la entidad y el estado activo. La integración no guarda una selección de MappingProfile.
              </p>
            </>
          )}
        </section>

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
