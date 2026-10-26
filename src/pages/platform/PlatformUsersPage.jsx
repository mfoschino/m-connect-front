import { useEffect, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import Pagination from '../../components/platform/Pagination'
import platformService from '../../services/api/platformService'
import { PAGE_SIZE, cleanParams, formatDate, getErrorMessage } from './platformUtils'

const accountStatusOptions = [
  { value: '', label: 'Todas las cuentas' },
  { value: 'true', label: 'Activas' },
  { value: 'false', label: 'Bloqueadas' },
]

const platformRoleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: 'superadmin', label: 'Solo superadmins' },
]

const PlatformUsersPage = () => {
  const [query, setQuery] = useState({ search: '', is_active: '', platform_role: '', skip: 0, reload: 0 })
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    platformService
      .listUsers(cleanParams({
        search: query.search,
        is_active: query.is_active,
        platform_role: query.platform_role,
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
        setError(getErrorMessage(err, 'No se pudieron cargar los usuarios.'))
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

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Consola de plataforma</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Usuarios</h2>
            <p className="section-subtitle">Todas las cuentas de la plataforma, de todos los tenants.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => updateQuery({ reload: query.reload + 1 })}
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
          title="No se pudo completar la acción"
          description={error}
          onClose={() => setError('')}
        />
      ) : null}

      <Card title="Directorio" description="Buscá por nombre o email y filtrá por estado o rol.">
        <form className="mb-6 flex flex-col gap-4 md:flex-row md:items-end" onSubmit={handleSearch}>
          <div className="flex-1">
            <Input
              id="user-search"
              label="Buscar"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Nombre o email"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="user-status" className="block text-sm font-semibold text-slate-900">
              Cuenta
            </label>
            <select
              id="user-status"
              className="form-input"
              value={query.is_active}
              onChange={(event) => updateQuery({ is_active: event.target.value, skip: 0 })}
            >
              {accountStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="user-role" className="block text-sm font-semibold text-slate-900">
              Rol de plataforma
            </label>
            <select
              id="user-role"
              className="form-input"
              value={query.platform_role}
              onChange={(event) => updateQuery({ platform_role: event.target.value, skip: 0 })}
            >
              {platformRoleOptions.map((option) => (
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
              <th>Email</th>
              <th>Rol de plataforma</th>
              <th>Cuenta</th>
              <th>Último acceso</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center text-sm text-slate-500">Cargando usuarios...</td>
              </tr>
            ) : page.items.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-sm text-slate-500">No hay usuarios para mostrar.</td>
              </tr>
            ) : (
              page.items.map((account) => (
                <tr key={account.id}>
                  <td className="font-medium text-slate-900">{account.full_name || 'Sin nombre'}</td>
                  <td>{account.email}</td>
                  <td>
                    {account.platform_role === 'superadmin' ? <Badge variant="pending">Superadmin</Badge> : '—'}
                  </td>
                  <td>
                    <Badge variant={account.is_active ? 'online' : 'offline'}>
                      {account.is_active ? 'Activa' : 'Bloqueada'}
                    </Badge>
                  </td>
                  <td>{formatDate(account.last_login)}</td>
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
    </div>
  )
}

export default PlatformUsersPage