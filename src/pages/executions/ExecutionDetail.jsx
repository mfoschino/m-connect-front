import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import executionService from '../../services/api/executionService'

const variantForStatus = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'ok' || s === 'success' || s === 'completed') return 'online'
  if (s === 'error' || s === 'failed') return 'failed'
  if (s === 'pending' || s === 'queued' || s === 'processing') return 'pending'
  if (s === 'retry' || s === 'retrying') return 'retrying'
  return 'offline'
}

const variantForLogLevel = (level) => {
  const l = String(level || '').toLowerCase()
  if (l === 'error') return 'failed'
  if (l === 'warning' || l === 'warn') return 'retrying'
  if (l === 'info') return 'online'
  if (l === 'debug') return 'pending'
  return 'offline'
}

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—')

const ExecutionDetail = () => {
  const { traceId } = useParams()
  const [execution, setExecution] = useState(null)
  const [logs, setLogs] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const integrationMap = useMemo(() => {
    return integrations.reduce((map, item) => {
      if (item?.id) {
        map[item.id] = item.name || item.source_entity || item.id
      }
      return map
    }, {})
  }, [integrations])

  const timeline = useMemo(() => {
    return [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  }, [logs])

  const fetchExecution = async () => {
    setLoading(true)
    setError(null)

    try {
      const [executionRes, logsRes, integrationsRes] = await Promise.all([
        executionService.getExecution(traceId),
        executionService.getExecutionLogs(traceId),
        executionService.listIntegrations(),
      ])

      setExecution(executionRes.data || null)
      setLogs(logsRes.data || [])
      setIntegrations(integrationsRes.data || [])
    } catch (err) {
      console.error('Execution detail fetch error', err)
      setError(
        err?.response?.status === 404
          ? 'No se encontró la ejecución solicitada.'
          : 'Error al cargar los detalles de ejecución.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchExecution()
  }, [traceId])

  const integrationName = execution?.integration_id
    ? integrationMap[execution.integration_id] || execution.integration_id
    : 'N/D'

  const errorDetail = execution?.error_detail

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Ejecución</p>
          <h2 className="section-title">Detalle de ejecución</h2>
          <p className="section-subtitle">
            Monitorea el estado y los eventos de una ejecución concreta del pipeline.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/executions">
            <Button variant="secondary">Volver a ejecuciones</Button>
          </Link>
          <Button onClick={() => { setRefreshing(true); fetchExecution() }} loading={refreshing}>
            Refrescar
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="error" title="Error" description={error} />
      ) : null}

      {loading ? (
        <Card title="Cargando ejecución...">
          <p className="text-sm text-slate-500">Espere mientras se obtienen los detalles.</p>
        </Card>
      ) : execution ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="Detalles de ejecución">
              <div className="space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-slate-500">Trace ID</p>
                  <p className="font-medium text-slate-900 break-words">{execution.trace_id || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Estado</p>
                  <Badge variant={variantForStatus(execution.status)}>{String(execution.status || '—')}</Badge>
                </div>
                <div>
                  <p className="text-slate-500">Sistema origen</p>
                  <p>{execution.source_system || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Entidad</p>
                  <p>{execution.entity || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Reintentos</p>
                  <p>{execution.retries ?? 0}</p>
                </div>
              </div>
            </Card>

            <Card title="Información de integración">
              <div className="space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-slate-500">Integración</p>
                  <p className="font-medium text-slate-900">{integrationName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Integration ID</p>
                  <p>{execution.integration_id || 'N/D'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Tenant ID</p>
                  <p>{execution.tenant_id || 'N/D'}</p>
                </div>
              </div>
            </Card>

            <Card title="Tiempos">
              <div className="space-y-3 text-sm text-slate-700">
                <div>
                  <p className="text-slate-500">Creado</p>
                  <p>{formatDate(execution.created_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Última actualización</p>
                  <p>{formatDate(execution.updated_at)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Error detalle</p>
                  {errorDetail ? (
                    <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-3 text-xs text-slate-800">
                      {JSON.stringify(errorDetail, null, 2)}
                    </pre>
                  ) : (
                    <p>No hay detalles de error disponibles.</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Timeline de eventos" description="Eventos ordenados cronológicamente.">
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">No hay eventos de ejecución disponibles.</p>
              ) : (
                <div className="space-y-4">
                  {timeline.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{log.event || 'Evento desconocido'}</p>
                          <p className="text-sm text-slate-500">{formatDate(log.timestamp)}</p>
                        </div>
                        <Badge variant={variantForLogLevel(log.level)}>{log.level || 'N/D'}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-700">{log.message || 'Sin mensaje adicional.'}</p>
                      {log.data ? (
                        <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-xs text-slate-800">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Logs de ejecución" description="Registro detallado devuelto por el backend.">
              {timeline.length === 0 ? (
                <p className="text-sm text-slate-500">No hay logs disponibles para esta ejecución.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Nivel</th>
                      <th>Evento</th>
                      <th>Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.timestamp)}</td>
                        <td><Badge variant={variantForLogLevel(log.level)}>{log.level || '—'}</Badge></td>
                        <td>{log.event || '—'}</td>
                        <td className="max-w-xl truncate text-slate-700">{log.message || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="Datos de entrada">
              <p className="text-sm text-slate-500">
                No disponible en la API actual.
              </p>
              {/* TODO(BACKEND): Add input payload support when /executions/{trace_id} exposes execution input data. */}
            </Card>
            <Card title="Datos de salida">
              <p className="text-sm text-slate-500">
                No disponible en la API actual.
              </p>
              {/* TODO(BACKEND): Add output payload support when backend exposes execution result data. */}
            </Card>
            <Card title="Reintentos / re-procesamiento">
              <p className="text-sm text-slate-500">
                La API actual no soporta reintento directo de una ejecución.
              </p>
              {/* TODO(BACKEND): Add POST /executions/{trace_id}/retry or equivalent reprocess endpoint. */}
            </Card>
          </div>

          <Card title="Rastreo y relación de ejecuciones">
            <p className="text-sm text-slate-500">
              La API actual solo expone el trace_id y los logs del mensaje.
            </p>
            {/* TODO(BACKEND): Add advanced trace lineage and related executions support. */}
          </Card>
        </div>
      ) : null}
    </div>
  )
}

export default ExecutionDetail
