import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import Pagination from '../../components/platform/Pagination'
import platformService from '../../services/api/platformService'
import AuditLogDetailModal from './AuditLogDetailModal'
import { describeTargetLocally } from './auditUtils'
import {
  PAGE_SIZE,
  cleanParams,
  formatDate,
  getErrorMessage,
  startOfDayIso,
  startOfNextDayIso,
} from './platformUtils'

// Categorías: el punto final hace que el backend traiga todas las acciones que empiezan así
const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas las categorías' },
  { value: 'auth.', label: 'Inicios de sesión' },
  { value: 'tenant.', label: 'Tenants' },
  { value: 'membership.', label: 'Accesos a tenants' },
  { value: 'invitation.', label: 'Invitaciones' },
  { value: 'user.', label: 'Cuentas de usuario' },
  { value: 'platform_role.', label: 'Rol de superadmin' },
  { value: 'support_session.', label: 'Sesiones de soporte' },
  { value: 'support.', label: 'Acciones en modo soporte' },
]

// Nombres legibles de las acciones. Si llega una que no está acá, se muestra el código tal cual.
const ACTION_LABELS = {
  'auth.login': 'Inicio de sesión',
  'auth.login_failed': 'Intento de inicio de sesión fallido',
  'tenant.updated': 'Tenant actualizado',
  'tenant.suspended': 'Tenant suspendido',
  'tenant.reactivated': 'Tenant reactivado',
  'membership.role_changed': 'Cambio de rol en un tenant',
  'membership.disabled': 'Acceso deshabilitado',
  'membership.reactivated': 'Acceso habilitado',
  'invitation.created': 'Invitación enviada',
  'user.blocked': 'Cuenta bloqueada',
  'user.unblocked': 'Cuenta desbloqueada',
  'user.unlocked': 'Bloqueo por intentos quitado',
  'user.sessions_revoked': 'Sesiones cerradas',
  'user.password_reset_forced': 'Cambio de contraseña forzado',
  'platform_role.granted': 'Rol de superadmin otorgado',
  'platform_role.revoked': 'Rol de superadmin quitado',
  'support_session.started': 'Sesión de soporte iniciada',
  'support_session.ended': 'Sesión de soporte terminada',
  'support.request': 'Acción en modo soporte',
  'auth.logout': 'Cierre de sesión',
  'auth.account_locked': 'Cuenta bloqueada por intentos fallidos',
  'auth.tenant_switched': 'Cambio de organización',
  'user.created': 'Cuenta creada',
  'user.password_reset': 'Contraseña restablecida',
  'membership.created': 'Acceso a tenant creado',
  'tenant.created': 'Tenant creado',
  'invitation.resent': 'Invitación reenviada',
  'invitation.accepted': 'Invitación aceptada',
  'invitation.revoked': 'Invitación revocada',
}

const ACTOR_KIND_LABELS = {
  platform_admin: 'Superadmin',
  support: 'Soporte',
  system: 'Sistema',
  user: 'Usuario',
}



const PlatformAuditPage = () => {
  // Los filtros viven en la URL, por ejemplo: /platform/audit?action=user.&since=2026-11-01
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = {
    action: searchParams.get('action') || '',
    since: searchParams.get('since') || '',
    until: searchParams.get('until') || '',
    tenant: searchParams.get('tenant') || '',
    actor: searchParams.get('actor') || '',
    skip: Number(searchParams.get('skip')) || 0,
  }

  // La URL completa de filtros, como texto: sirve para saber cuándo cambiaron
  const paramsKey = searchParams.toString()

  const [reload, setReload] = useState(0)
  const [dateDraft, setDateDraft] = useState({ since: filters.since, until: filters.until })
  const [dateError, setDateError] = useState('')
  const [page, setPage] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantNames, setTenantNames] = useState({})
  const [selectedLog, setSelectedLog] = useState(null)

  // Nota para el BackLink: volver a la auditoría CON los filtros que tenía
  const backToAudit = {
    from: {
      pathname: paramsKey ? `/platform/audit?${paramsKey}` : '/platform/audit',
      label: 'Volver a auditoría',
    },
  }

  // Los nombres de los tenants se piden una sola vez
  useEffect(() => {
    let cancelled = false

    platformService
      .listTenants({ limit: 200 })
      .then((response) => {
        if (cancelled) return
        const items = response.data?.items ?? []
        setTenantNames(Object.fromEntries(items.map((tenant) => [tenant.id, tenant.name])))
      })
      .catch(() => {
        // Si falla, se muestran los ids recortados
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Los registros, cada vez que cambian los filtros de la URL o se aprieta Refrescar
  useEffect(() => {
    let cancelled = false
    const current = new URLSearchParams(paramsKey)

    platformService
      .listAuditLogs(cleanParams({
        action: current.get('action') || '',
        since: startOfDayIso(current.get('since') || ''),
        until: startOfNextDayIso(current.get('until') || ''),
        tenant_id: current.get('tenant') || '',
        actor_user_id: current.get('actor') || '',
        skip: Number(current.get('skip')) || 0,
        limit: PAGE_SIZE,
      }))
      .then((response) => {
        if (cancelled) return
        setPage({ items: response.data?.items ?? [], total: response.data?.total ?? 0 })
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(getErrorMessage(err, 'No se pudo cargar la auditoría.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [paramsKey, reload])

  // Cambia algunos filtros de la URL. Los vacíos se borran, para que la dirección quede limpia.
  const updateFilters = (changes) => {
    setLoading(true)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => {
        if (value === '' || value === 0 || value === null || value === undefined) {
          next.delete(key)
        } else {
          next.set(key, String(value))
        }
      })
      return next
    })
  }

  const handleRefresh = () => {
    setLoading(true)
    setReload((current) => current + 1)
  }

  const handleDateSubmit = (event) => {
    event.preventDefault()

    if (dateDraft.since && dateDraft.until && dateDraft.since > dateDraft.until) {
      setDateError('La fecha "desde" no puede ser posterior a la fecha "hasta".')
      return
    }

    setDateError('')
    updateFilters({ since: dateDraft.since, until: dateDraft.until, skip: 0 })
  }

  const handleClearFilters = () => {
    setDateDraft({ since: '', until: '' })
    setDateError('')
    setLoading(true)
    setSearchParams({})
  }

  const renderTenant = (tenantId) => {
    if (!tenantId) return '—'
    return (
      <Link
        to={`/platform/tenants/${tenantId}`}
        state={backToAudit}
        className="hover:underline"
      >
        {tenantNames[tenantId] || `${tenantId.slice(0, 8)}…`}
      </Link>
    )
  }

  const renderTarget = (log) => {
    const text = describeTargetLocally(log, tenantNames)

    //Usuarios: siempre un linkk a su detalle, con el email si lo tenemos
    if (log.target_type === 'user' && log.target_id) {
      return (
        <Link
          to={`/platform/users/${log.target_id}`}
          state={backToAudit}
          className="hover:underline"
        >
          {text || 'Ver usuario'}
        </Link>
      )
    }

    //Tenants: un link a su detalle, con su nombre
    if (log.target_type === 'tenant' && log.target_id) {
      return (
        <Link
          to={`/platform/tenants/${log.target_id}`}
          state={backToAudit}
          className="hover:underline"
        >
          {text}
        </Link>
      )
    }

    return text
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          Consola de plataforma
        </p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Auditoría</h2>
            <p className="section-subtitle">
              Quién hizo qué, y cuándo, en toda la plataforma.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={ handleRefresh }
            loading={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refrescar
          </Button>
        </div>
      </div>

      {error ? (
        <Alert
          variant="error"
          title="No se pudo cargar la auditoría"
          description={error}
          onClose={() => setError('')}
        />
      ) : null}

      <Card
        title="Registros"
        description={
          loading
            ? 'Actividad de la plataforma.'
            : `${page.total} registros encontrados.`
        }
      >
        <div className="mb-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="audit-category"
              className="block text-sm font-semibold text-slate-900"
            >
              Categoría
            </label>
            <select
              id="audit-category"
              className="form-input"
              value={filters.action}
              onChange={(event) =>
                updateFilters({ action: event.target.value, skip: 0 })
              }
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <form
            className="flex flex-col gap-4 md:flex-row md:items-end"
            onSubmit={handleDateSubmit}
          >
            <Input
              id="audit-since"
              label="Desde"
              type="date"
              value={dateDraft.since}
              onChange={(event) =>
                setDateDraft((current) => ({
                  ...current,
                  since: event.target.value,
                }))
              }
            />
            <Input
              id="audit-until"
              label="Hasta"
              type="date"
              value={dateDraft.until}
              onChange={(event) =>
                setDateDraft((current) => ({
                  ...current,
                  until: event.target.value,
                }))
              }
            />
            <Button type="submit">Aplicar fechas</Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
            >
              Limpiar filtros
            </Button>
          </form>

          {dateError ? (
            <p className="text-sm font-medium text-red-600">{dateError}</p>
          ) : null}

          {filters.tenant || filters.actor ? (
            <div className="flex flex-wrap gap-2">
              {filters.tenant ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  Tenant: {tenantNames[filters.tenant] || `${filters.tenant.slice(0, 8)}…`}
                  <button
                    type="button"
                    onClick={() => updateFilters({ tenant: '', skip: 0 })}
                    className="font-semibold text-slate-500 hover:text-slate-900"
                    aria-label="Quitar el filtro de tenant"
                  >
                    ×
                  </button>
                </span>
              ) : null}
              {filters.actor ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                  Acciones de un usuario ({filters.actor.slice(0, 8)}…)
                  <button
                    type="button"
                    onClick={() => updateFilters({ actor: '', skip: 0 })}
                    className="font-semibold text-slate-500 hover:text-slate-900"
                    aria-label="Quitar el filtro de usuario"
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </div>
          ) : null}

        </div>

        <Table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Quién</th>
              <th>Acción</th>
              <th>Tenant</th>
              <th>Sobre</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center text-sm text-slate-500">
                  Cargando registros...
                </td>
              </tr>
            ) : page.items.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-sm text-slate-500">
                  No hay registros con estos filtros.
                </td>
              </tr>
            ) : (
              page.items.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap">
                    {formatDate(log.occurred_at)}
                  </td>
                  <td>
                    <p className="font-medium text-slate-900">
                      {log.actor_email ||
                        ACTOR_KIND_LABELS[log.actor_kind] ||
                        '—'}
                    </p>
                    {log.actor_email ? (
                      <p className="text-xs text-slate-500">
                        {ACTOR_KIND_LABELS[log.actor_kind] || log.actor_kind}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <p>{ACTION_LABELS[log.action] || log.action}</p>
                    <p className="text-xs text-slate-400">{log.action}</p>
                  </td>
                  <td>{renderTenant(log.tenant_id)}</td>
                  <td>{renderTarget(log)}</td>
                  <td>
                    <Button
                      variant="ghost"
                      className="rounded-full px-3 py-1 text-sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <Pagination
          skip={filters.skip}
          limit={PAGE_SIZE}
          total={page.total}
          disabled={loading}
          onChange={(skip) => updateFilters({ skip })}
        />
      </Card>
      {selectedLog ? (
        <AuditLogDetailModal
          log={selectedLog}
          actionLabel={ACTION_LABELS[selectedLog.action] || selectedLog.action}
          actorKindLabel={
            ACTOR_KIND_LABELS[selectedLog.actor_kind] || selectedLog.actor_kind
          }
          tenantName={
            selectedLog.tenant_id
              ? tenantNames[selectedLog.tenant_id] || selectedLog.tenant_id
              : null
          }
          tenantNames={tenantNames}
          onClose={() => setSelectedLog(null)}
        />
      ) : null}
    </div>
  )
}

export default PlatformAuditPage
