import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import executionService from '../../services/api/executionService'
import { getExecutionIdentifier } from '../../services/adapters/executionAdapter'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import { getExecutionStatusLabel } from '../../utils/presentationUtils'

const variantForStatus = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'ok' || s === 'success' || s === 'completed') return 'online'
  if (s === 'error' || s === 'failed') return 'failed'
  if (s === 'pending' || s === 'queued' || s === 'processing') return 'pending'
  if (s === 'retry' || s === 'retrying') return 'retrying'
  return 'offline'
}

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-AR')
}

const getExecutionMessage = (execution) => {
  const value = execution?.error ?? execution?.message ?? execution?.error_detail

  if (!value) return '—'
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}

const loadExecutionsData = async () => {
  const [executionsRes, integrationsRes] = await Promise.all([
    executionService.listExecutions(),
    executionService.listIntegrations(),
  ])

  return {
    executions: Array.isArray(executionsRes.data) ? executionsRes.data : [],
    integrations: Array.isArray(integrationsRes.data) ? integrationsRes.data : [],
  }
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
      const data = await loadExecutionsData()
      setExecutions(data.executions)
      setIntegrations(data.integrations)
    } catch (err) {
      console.error('Failed to load executions', err)
      setError('No se pudieron cargar las ejecuciones. Intenta recargar.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    let active = true

    loadExecutionsData()
      .then((data) => {
        if (!active) return
        setExecutions(data.executions)
        setIntegrations(data.integrations)
      })
      .catch((err) => {
        if (!active) return
        console.error('Failed to load executions', err)
        setError('No se pudieron cargar las ejecuciones. Intenta recargar.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
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
        execution.id,
        execution.task_id,
        execution.integration_name,
        execution.message,
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
        <h2 className="section-title">Actividad de los flujos de procesamiento</h2>
        <p className="section-subtitle">
          Haz seguimiento de ejecuciones recientes, detecta lentitudes y monitorea el estado de tus flujos de trabajo.
        </p>
      </div>

      <Card
        title="Filtros"
        description="Buscá por ID de seguimiento, integración, entidad o sistema de origen."
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
            placeholder="ID de seguimiento, integración, entidad..."
          />
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
      </Card>

      <Card title="Ejecuciones recientes" description="Flujos de procesamiento más recientes y su estado actual.">
        <Table>
          <thead>
            <tr>
              <th>ID / ID de seguimiento</th>
              <th>Integración</th>
              <th>Estado</th>
              <th>Inicio</th>
              <th>Fin / actualización</th>
              <th>ID de tarea</th>
              <th>Error / mensaje</th>
              <th>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-sm text-slate-500">
                  {loading
                    ? 'Cargando ejecuciones...'
                    : search.trim()
                      ? 'No hay ejecuciones que coincidan con la búsqueda.'
                      : 'Todavía no hay ejecuciones registradas. Si acabás de iniciar una ejecución, actualizá cuando el servidor haya creado sus mensajes.'}
                </td>
              </tr>
            ) : (
              filteredExecutions.map((execution, index) => {
                const identifier = getExecutionIdentifier(execution)
                const integrationLabel = execution.integration_name
                  || integrationMap[execution.integration_id]
                  || execution.integration_id
                  || '—'

                return (
                  <tr key={`${identifier || 'execution'}-${index}`} className="hover:bg-slate-50">
                    <td>
                      {execution.trace_id ? (
                        <Link to={`/executions/${execution.trace_id}`} className="font-medium text-sky-600 hover:text-sky-700">
                          {execution.trace_id}
                        </Link>
                      ) : (
                        <span className="font-medium text-slate-900">{identifier || '—'}</span>
                      )}
                    </td>
                    <td>{integrationLabel}</td>
                    <td><Badge variant={variantForStatus(execution.status)}>{getExecutionStatusLabel(execution.status)}</Badge></td>
                    <td>{formatDate(execution.started_at ?? execution.created_at)}</td>
                    <td>{formatDate(execution.finished_at ?? execution.updated_at)}</td>
                    <td>{execution.task_id || '—'}</td>
                    <td className="max-w-sm truncate" title={getExecutionMessage(execution)}>
                      {getExecutionMessage(execution)}
                    </td>
                    <td>
                      {execution.trace_id ? (
                        <Link className="font-medium text-sky-600 hover:text-sky-700" to={`/executions/${execution.trace_id}`}>
                          Ver detalle
                        </Link>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Executions
