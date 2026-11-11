import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import BackLink from '../../components/platform/BackLink'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import platformService from '../../services/api/platformService'
import EditTenantModal from './EditTenantModal'
import TenantStatusModal from './TenantStatusModal'
import { formatDate, getErrorMessage } from './platformUtils'
import TenantMembersCard from './TenantMembersCard'
import TenantInvitationsCard from './TenantInvitationsCard'


const PlatformTenantDetailPage = () => {
  // Lee la parte variable de la URL: /platform/tenants/:tenantId
  const { tenantId } = useParams()

  const backLink = <BackLink fallbackTo="/platform/tenants" fallbackLabel="Volver a tenants" />

  const [tenant, setTenant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    platformService
      .getTenant(tenantId)
      .then((response) => {
        if (cancelled) return
        setTenant(response.data)
        setNotFound(false)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        if (err?.response?.status === 404) {
          setNotFound(true)
        } else {
          setError(getErrorMessage(err, 'No se pudo cargar el tenant.'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tenantId, reload])

  const handleActionDone = (message) => {
    setEditOpen(false)
    setStatusOpen(false)
    setSuccessMessage(message)
    setReload((current) => current + 1)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {backLink}
        <p className="text-sm text-slate-500">Cargando tenant...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        {backLink}
        <Card title="Tenant no encontrado" description="El tenant que buscás no existe o la dirección está mal escrita." />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        {backLink}
        <Alert variant="error" title="No se pudo cargar el tenant" description={error} />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {backLink}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Tenant</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="section-title">{tenant.name}</h2>
            <Badge variant={tenant.is_active ? 'online' : 'offline'}>
              {tenant.is_active ? 'Activo' : 'Suspendido'}
            </Badge>
          </div>
          <p className="section-subtitle">
            Plan: {tenant.plan || '—'} · Creado: {formatDate(tenant.created_at)}
          </p>
          {!tenant.is_active && tenant.suspended_reason ? (
            <p className="text-sm text-slate-500">Motivo de la suspensión: {tenant.suspended_reason}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
          <Button variant={tenant.is_active ? 'danger' : 'primary'} onClick={() => setStatusOpen(true)}>
            {tenant.is_active ? 'Suspender' : 'Reactivar'}
          </Button>
          <Link to={`/platform/audit?tenant=${tenantId}`} className="btn btn-outline">
            Ver actividad
          </Link>
        </div>
      </div>

      {successMessage ? (
        <Alert
          variant="success"
          title="Operación completada"
          description={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      ) : null}

      {error ? (
        <Alert variant="error" title="No se pudo actualizar la información" description={error} onClose={() => setError('')} />
      ) : null}

      <TenantMembersCard tenantId={tenantId} />

      <TenantInvitationsCard tenantId={tenantId} tenantActive={tenant.is_active} />

      {editOpen ? (
        <EditTenantModal tenant={tenant} onClose={() => setEditOpen(false)} onSaved={handleActionDone} />
      ) : null}

      {statusOpen ? (
        <TenantStatusModal tenant={tenant} onClose={() => setStatusOpen(false)} onDone={handleActionDone} />
      ) : null}
    </div>
  )
}

export default PlatformTenantDetailPage