import { useEffect, useState } from 'react'
import { Plus, RefreshCw, Search } from 'lucide-react'
import CreateTenantModal from './CreateTenantModal'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import Pagination from '../../components/platform/Pagination'
import platformService from '../../services/api/platformService'
import { PAGE_SIZE, cleanParams, formatDate, getErrorMessage } from './platformUtils'
import EditTenantModal from './EditTenantModal'
import TenantStatusModal from './TenantStatusModal'
import { Link } from 'react-router-dom'

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activos' },
  { value: 'suspended', label: 'Suspendidos' },
]

const PlatformTenantsPage = () => {
  // Qué le estamos pidiendo al backend
  const [query, setQuery] = useState({ search: '', status: '', skip: 0, reload: 0 })
  // Lo que el usuario está escribiendo (todavía no buscado)
  const [searchText, setSearchText] = useState('')
  // Lo que respondió el backend
  const [page, setPage] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [editingTenant, setEditingTenant] = useState(null)
  const [statusTenant, setStatusTenant] = useState(null)


  // Cada vez que cambia "query", pedimos los datos de nuevo
  useEffect(() => {
    let cancelled = false

    platformService
      .listTenants(cleanParams({
        search: query.search,
        status: query.status,
        skip: query.skip,
        limit: PAGE_SIZE,
      }))
      .then((response) => {
        if (cancelled) return
        setPage({ items: response.data?.items ?? [], total: response.data?.total ?? 0 })
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(getErrorMessage(err, 'No se pudieron cargar los tenants.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [query])

  const updateQuery = (changes) => {
    setLoading(true)
    setQuery((current) => ({ ...current, ...changes }))
  }

  const handleSearch = (event) => {
    event.preventDefault()
    updateQuery({ search: searchText.trim(), skip: 0 })
  }

  const handleCreated = (result) => {
    setCreateOpen(false)

    const tenantName = result?.tenant?.name ?? 'El tenant'
    const invitedEmail = result?.admin_invitation?.email

        setSuccessMessage(
            invitedEmail
            ? `${tenantName} se creó correctamente. Se envió una invitación a ${invitedEmail}.`
            : `${tenantName} se creó correctamente.`,
        )

        updateQuery({ reload: query.reload + 1 })
  }
  
  const handleActionDone = (message) => {
    setEditingTenant(null)
    setStatusTenant(null)
    setSuccessMessage(message)
    updateQuery({ reload: query.reload + 1 })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Consola de plataforma</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Tenants</h2>
            <p className="section-subtitle">Organizaciones registradas en M-Connect.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
                variant="outline"
                onClick={() => updateQuery({ reload: query.reload + 1 })}
                loading={loading}
            >
                <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                Refrescar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Nuevo tenant
            </Button>
          </div>
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
        <Alert
          variant="error"
          title="No se pudo completar la acción"
          description={error}
          onClose={() => setError('')}
        />
      ) : null}

      <Card title="Listado" description="Buscá por nombre y filtrá por estado.">
        <form className="mb-6 flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleSearch}>
          <div className="flex-1">
            <Input
              id="tenant-search"
              label="Buscar"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Nombre del tenant"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="tenant-status" className="block text-sm font-semibold text-slate-900">
              Estado
            </label>
            <select
              id="tenant-status"
              className="form-input"
              value={query.status}
              onChange={(event) => updateQuery({ status: event.target.value, skip: 0 })}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Buscar
          </Button>
        </form>

        <Table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Creado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center text-sm text-slate-500">Cargando tenants...</td>
              </tr>
            ) : page.items.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-sm text-slate-500">No hay tenants para mostrar.</td>
              </tr>
            ) : (
              page.items.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <Link
                      to={`/platform/tenants/${tenant.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </td>
                  <td>{tenant.plan || '—'}</td>
                  <td>
                    <Badge variant={tenant.is_active ? 'online' : 'offline'}>
                      {tenant.is_active ? 'Activo' : 'Suspendido'}
                    </Badge>
                    {!tenant.is_active && tenant.suspended_reason? (
                        <p className="mt-1 text-xs text-slate-500">{tenant.suspended_reason }</p>
                    ) : null}
                  </td>
                  <td>{formatDate(tenant.created_at)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                        <button
                            variant="ghost"
                            className="rounded-full px-3 py-1 text-sm"
                            onClick={() => setEditingTenant(tenant)}
                        >
                            Editar
                        </button>
                        <button
                            variant="ghost"
                            className={`rounded-full px-3 py-1 text-sm ${tenant.is_active ? 'text-rose-600' : 'text-emerald-700'}`}
                            onClick={() => setStatusTenant(tenant)}
                        >
                            {tenant.is_active ? 'suspender' : 'Reactivar'}
                        </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>

        <Pagination
          skip={query.skip}
          limit={PAGE_SIZE}
          total={page.total}
          disabled={loading}
          onChange={(skip) => updateQuery({ skip })}
        />
      </Card>
        {createOpen ? (
            <CreateTenantModal
                onClose={() => setCreateOpen(false)}
                onCreated={handleCreated}
            />
        ) : null}

        {editingTenant ? (
            <EditTenantModal
                tenant={editingTenant}
                onClose={() => setEditingTenant(null)}
                onSaved={handleActionDone}
            />    
        ) : null}    

        {statusTenant ? (
            <TenantStatusModal
                tenant={statusTenant}
                onClose={() =>setStatusTenant(null)}
                onDone={handleActionDone}
            />
        ) : null}
    </div>
  )
}

export default PlatformTenantsPage