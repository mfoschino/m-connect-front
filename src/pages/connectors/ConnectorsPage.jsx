import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import connectorService from '../../services/api/connectorService'
import { connectorAvailability, filterConnectorDefinitions,
  filterConnectorInstallations } from '../../services/adapters/connectorAdapter'
import { getIamPermissions } from '../../services/auth/iamPermissions'
import { createConnectorReadFlow, initialConnectorReadState } from '../../services/connectorReadFlow'

const kindLabel = (kind) => ({ input: 'Entrada', output: 'Salida' }[kind] || 'Sin información')
const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-AR')
}

const ActivityBadge = ({ active }) => <Badge variant={active === true ? 'online' : 'offline'}>
  {active === true ? 'Activa' : active === false ? 'Inactiva' : 'Sin información'}
</Badge>

const AvailabilityBadge = ({ definition }) => {
  const availability = connectorAvailability(definition)
  return <Badge variant={availability === 'available' ? 'online' : 'offline'}>
    {{ available: 'Disponible', inactive: 'Desactivado', unpublished: 'Sin publicar',
      unknown: 'Sin información' }[availability]}
  </Badge>
}

const SelectFilter = ({ id, label, value, onChange, children }) => (
  <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-semibold text-slate-900">{label}</label>
    <select id={id} className="form-input" value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  </div>
)

const ReadState = ({ resource, label, onRetry, children }) => {
  if (resource.loading) return <p role="status" className="py-10 text-center text-sm text-slate-500">
    Cargando {label}…
  </p>
  if (resource.error) return <div className="space-y-4">
    <Alert variant="error" title={`No se pudo consultar ${label}`} description={resource.error} />
    <Button type="button" variant="outline" onClick={onRetry}>Reintentar</Button>
  </div>
  return children
}

export const InstallationDetail = ({ detail, onRetry, onClose }) => (
  <Modal open={detail.open} title="Detalle de la instalación" onClose={onClose}
    footer={<Button type="button" variant="outline" onClick={onClose}>Cerrar</Button>}>
    <ReadState resource={detail} label="el detalle" onRetry={onRetry}>
      {detail.data ? <dl className="grid gap-5 text-sm sm:grid-cols-2">
        <div><dt className="font-semibold text-slate-500">Nombre</dt><dd className="break-words">{detail.data.name}</dd></div>
        <div><dt className="font-semibold text-slate-500">Conector</dt><dd>{detail.data.connector.name}</dd></div>
        <div><dt className="font-semibold text-slate-500">Tipo</dt><dd>{kindLabel(detail.data.connector.kind)}</dd></div>
        <div><dt className="font-semibold text-slate-500">Versión fijada</dt><dd>{detail.data.version || '—'}</dd></div>
        <div><dt className="mb-1 font-semibold text-slate-500">Estado</dt><dd><ActivityBadge active={detail.data.is_active} /></dd></div>
        <div><dt className="font-semibold text-slate-500">Credenciales</dt><dd>
          {Array.isArray(detail.data.secret_fields)
            ? `${detail.data.secret_fields.length} campo(s) secreto(s) cargado(s)` : 'Sin información'}
        </dd><dd className="mt-1 text-slate-500">Los valores de las credenciales no se muestran.</dd></div>
        <div><dt className="font-semibold text-slate-500">Creada</dt><dd>{formatDate(detail.data.created_at)}</dd></div>
        <div><dt className="font-semibold text-slate-500">Última actualización</dt><dd>{formatDate(detail.data.updated_at)}</dd></div>
        <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">ID de instalación</dt>
          <dd className="break-all font-mono text-xs">{detail.data.id}</dd></div>
      </dl> : <p role="status">El detalle de la instalación no está disponible.</p>}
    </ReadState>
  </Modal>
)

export const ConnectorsContent = ({ directory, activeView, onViewChange, filters, onFilterChange,
  onRefresh, onOpenDetail, onCloseDetail, onRetryDetail }) => {
  const installationsView = activeView === 'installations'
  const resource = installationsView ? directory.installations : directory.definitions
  const rows = installationsView
    ? filterConnectorInstallations(resource.data, filters)
    : filterConnectorDefinitions(resource.data, filters)
  const definitionOptions = [...new Map(directory.installations.data.map((installation) => (
    [installation.connector.id, installation.connector]
  ))).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const emptyMessage = resource.data.length === 0
    ? installationsView ? 'Todavía no hay instalaciones en esta organización.' : 'No hay conectores en el catálogo disponible.'
    : 'No hay resultados para la búsqueda y los filtros seleccionados.'

  return <div className="space-y-8">
    <div className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Conectores</p>
      <h2 className="section-title">Conexiones de tu organización</h2>
      <p className="section-subtitle">Consultá las instalaciones y el catálogo de conectores disponibles.</p>
    </div>
    <div role="group" aria-label="Vistas de conectores" className="flex flex-wrap gap-2">
      <Button type="button" variant={installationsView ? 'primary' : 'outline'}
        aria-pressed={installationsView} onClick={() => onViewChange('installations')}>Instalaciones</Button>
      <Button type="button" variant={!installationsView ? 'primary' : 'outline'}
        aria-pressed={!installationsView} onClick={() => onViewChange('definitions')}>Catálogo</Button>
    </div>
    <Card title={installationsView ? 'Instalaciones' : 'Catálogo'}
      description={installationsView ? 'Conexiones configuradas para la organización activa.'
        : 'Definiciones públicas y privadas disponibles para tu organización.'}
      actions={<Button type="button" variant="outline" className="gap-2" disabled={resource.loading}
        onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" />Recargar</Button>}>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Input id="connector-search" label="Buscar" placeholder={installationsView ? 'Nombre o conector' : 'Nombre o descripción'}
          value={filters.search} onChange={(event) => onFilterChange('search', event.target.value)} />
        <SelectFilter id="connector-kind" label="Tipo" value={filters.kind} onChange={(value) => onFilterChange('kind', value)}>
          <option value="">Todos</option><option value="input">Entrada</option><option value="output">Salida</option>
        </SelectFilter>
        {installationsView ? <>
          <SelectFilter id="connector-status" label="Estado" value={filters.status} onChange={(value) => onFilterChange('status', value)}>
            <option value="">Todos</option><option value="active">Activas</option><option value="inactive">Inactivas</option>
          </SelectFilter>
          <SelectFilter id="connector-definition" label="Conector" value={filters.definitionId}
            onChange={(value) => onFilterChange('definitionId', value)}>
            <option value="">Todos</option>
            {filters.definitionId && !definitionOptions.some((definition) => definition.id === filters.definitionId)
              ? <option value={filters.definitionId}>Conector fuera del listado</option> : null}
            {definitionOptions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}</option>)}
          </SelectFilter>
        </> : <SelectFilter id="connector-availability" label="Disponibilidad" value={filters.availability}
          onChange={(value) => onFilterChange('availability', value)}>
          <option value="">Todas</option><option value="available">Disponibles</option>
          <option value="unpublished">Sin publicar</option><option value="inactive">Desactivados</option>
        </SelectFilter>}
      </div>
      <ReadState resource={resource} label={installationsView ? 'las instalaciones' : 'el catálogo'} onRetry={onRefresh}>
        {rows.length === 0 ? <p role="status" className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
          : <Table>
            <caption className="sr-only">{installationsView ? 'Instalaciones del tenant activo' : 'Catálogo de conectores'}</caption>
            <thead><tr>
              <th scope="col">Nombre</th><th scope="col">{installationsView ? 'Conector' : 'Descripción'}</th>
              <th scope="col">Tipo</th><th scope="col">{installationsView ? 'Versión fijada' : 'Versión publicada'}</th>
              <th scope="col">{installationsView ? 'Estado' : 'Disponibilidad'}</th>
              {installationsView ? <th scope="col">Detalle</th> : null}
            </tr></thead>
            <tbody>{rows.map((item) => <tr key={item.id}>
              <td className="font-medium text-slate-900">{item.name}</td>
              <td className="max-w-md break-words">{installationsView ? item.connector.name : item.description || '—'}</td>
              <td>{kindLabel(installationsView ? item.connector.kind : item.kind)}</td>
              <td>{(installationsView ? item.version : item.active_version?.version) || '—'}</td>
              <td>{installationsView ? <ActivityBadge active={item.is_active} /> : <AvailabilityBadge definition={item} />}</td>
              {installationsView ? <td><Button type="button" variant="ghost" onClick={() => onOpenDetail(item.id)}
                aria-label={`Ver detalle de ${item.name}`}>Ver detalle</Button></td> : null}
            </tr>)}</tbody>
          </Table>}
      </ReadState>
    </Card>
    <InstallationDetail detail={directory.detail} onClose={onCloseDetail} onRetry={onRetryDetail} />
  </div>
}

const emptyFilters = { search: '', kind: '', status: '', definitionId: '', availability: '' }

const ConnectorsSession = ({ tenantId }) => {
  const [directory, setDirectory] = useState(initialConnectorReadState)
  const [activeView, setActiveView] = useState('installations')
  const [viewFilters, setViewFilters] = useState({ installations: emptyFilters, definitions: emptyFilters })
  const flowRef = useRef(null)

  useEffect(() => {
    const flow = createConnectorReadFlow({ api: connectorService, tenantId, onChange: setDirectory })
    flowRef.current = flow
    void flow.loadInstallations()
    void flow.loadDefinitions()
    return () => {
      flow.dispose()
      if (flowRef.current === flow) flowRef.current = null
    }
  }, [tenantId])

  return <ConnectorsContent directory={directory} activeView={activeView} filters={viewFilters[activeView]}
    onViewChange={(view) => { flowRef.current?.closeDetail(); setActiveView(view) }}
    onFilterChange={(field, value) => setViewFilters((current) => ({ ...current,
      [activeView]: { ...current[activeView], [field]: value } }))}
    onRefresh={() => activeView === 'installations' ? flowRef.current?.loadInstallations() : flowRef.current?.loadDefinitions()}
    onOpenDetail={(id) => flowRef.current?.openDetail(id)} onCloseDetail={() => flowRef.current?.closeDetail()}
    onRetryDetail={() => flowRef.current?.openDetail(directory.detail.id)} />
}

const ConnectorsPage = () => {
  const auth = useAuth()
  const { user, contextId } = auth
  if (!getIamPermissions(auth).canViewConnectors || !contextId) {
    return <Alert variant="warning" title="Consulta no disponible"
      description="Necesitás una sesión con acceso a una organización para consultar sus conectores." />
  }
  // El remount descarta listas, filtros y detalle antes de pintar un contexto nuevo.
  return <ConnectorsSession key={JSON.stringify([contextId, user.tenant_id, user.id, user.role,
    user.support_session?.id, user.support_session?.access_level])} tenantId={user.tenant_id} />
}

export default ConnectorsPage
