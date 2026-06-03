import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import executionService from '../../services/api/executionService'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'

const variantForStatus = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'ok' || s === 'success' || s === 'completed') return 'online'
  if (s === 'error' || s === 'failed') return 'failed'
  if (s === 'pending' || s === 'queued' || s === 'processing') return 'pending'
  if (s === 'retry' || s === 'retrying') return 'retrying'
  return 'offline'
}

const Executions = () => {
  const [executions, setExecutions] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchExecutions = async () => {
    setLoading(true)
    setError(null)

    try {
      const [executionsRes, integrationsRes] = await Promise.all([
        executionService.listExecutions(),
        executionService.listIntegrations(),
      ])

      setExecutions(executionsRes.data || [])
      setIntegrations(integrationsRes.data || [])
    } catch (err) {
      console.error('Failed to load executions', err)
      setError('No se pudieron cargar las ejecuciones. Intenta recargar.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchExecutions()
  }, [])

  const integrationMap = useMemo(() => {
    return integrations.reduce((map, integration) => {
      if (integration?.id) {
        map[integration.id] = integration.name || integration.source_entity || integration.id
      }
      return map
    }, {})
  }, [integrations])

  const filteredExecutions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return executions

    return executions.filter((execution) => {
      const integrationName = integrationMap[execution.integration_id] || ''
      return [
        execution.trace_id,
        integrationName,
        execution.source_system,
        execution.entity,
        execution.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [executions, integrationMap, search])

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Ejecuciones</p>
        <h2 className="section-title">Actividad de pipelines</h2>
        <p className="section-subtitle">
          Haz seguimiento de ejecuciones recientes, detecta lentitudes y monitorea el estado de tus flujos de trabajo.
        </p>
      </div>

      <Card
        title="Filtros"
        description="Busca por trace id, integración, entidad o sistema origen."
        actions={
          <Button onClick={() => { setRefreshing(true); fetchExecutions() }} loading={refreshing}>
            Refrescar
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            id="execution-search"
            label="Buscar ejecuciones"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Trace ID, integración, entidad..."
          />
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      </Card>

      <Card title="Ejecuciones recientes" description="Pipelines más recientes y su estado actual.">
        <Table>
          <thead>
            <tr>
              <th>Trace ID</th>
              <th>Integración</th>
              <th>Sistema origen</th>
              <th>Entidad</th>
              <th>Estado</th>
              <th>Reintentos</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center text-sm text-slate-500">
                  {loading ? 'Cargando ejecuciones...' : 'No se encontraron ejecuciones.'}
                </td>
              </tr>
            ) : (
              filteredExecutions.map((execution) => (
                <tr key={execution.trace_id} className="hover:bg-slate-50">
                  <td>
                    <Link to={`/executions/${execution.trace_id}`} className="font-medium text-sky-600 hover:text-sky-700">
                      {execution.trace_id || '—'}
                    </Link>
                  </td>
                  <td>{integrationMap[execution.integration_id] || execution.integration_id || '—'}</td>
                  <td>{execution.source_system || '—'}</td>
                  <td>{execution.entity || '—'}</td>
                  <td><Badge variant={variantForStatus(execution.status)}>{String(execution.status || '—')}</Badge></td>
                  <td>{execution.retries ?? 0}</td>
                  <td>{execution.created_at ? new Date(execution.created_at).toLocaleString() : '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Executions
