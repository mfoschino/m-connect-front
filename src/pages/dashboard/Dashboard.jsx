import { useEffect, useMemo, useState } from 'react'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import Alert from '../../components/ui/Alert'
import Input from '../../components/ui/Input'
import apiClient from '../../services/api/client'

const variantForStatus = (status) => {
  const s = String(status).toLowerCase()
  if (s === 'success' || s === 'ok' || s === 'completed') return 'online'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'pending' || s === 'queued') return 'pending'
  if (s === 'retrying') return 'retrying'
  return 'offline'
}

const Dashboard = () => {
  const [integrations, setIntegrations] = useState([])
  const [executions, setExecutions] = useState([])
  const [filters, setFilters] = useState({ integration: '', source: '', from: '', to: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [intRes, execRes] = await Promise.all([
          apiClient.get('/integrations'),
          apiClient.get('/executions'),
        ])
        if (!mounted) return
        setIntegrations(intRes?.data || [])
        setExecutions(execRes?.data || [])
      } catch (err) {
        // keep existing static values if API unavailable
        console.error('Dashboard fetch error', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const totalIntegrations = integrations.length
    const activeIntegrations = integrations.filter((i) => i.is_active !== false).length
    const inactiveIntegrations = totalIntegrations - activeIntegrations
    const totalExecutions = executions.length
    const successes = executions.filter((e) => String(e.status).toLowerCase() === 'success').length
    const errors = executions.filter((e) => String(e.status).toLowerCase() === 'failed' || String(e.status).toLowerCase() === 'error').length
    const successRate = totalExecutions ? Math.round((successes / totalExecutions) * 100) : 0
    const errorRate = totalExecutions ? Math.round((errors / totalExecutions) * 100) : 0
    const alerts = executions
      .filter((e) => String(e.status).toLowerCase() === 'failed' || (e.retries && e.retries > 0))
      .map((e) => ({
        id: e.trace_id || e.id || Math.random().toString(36).slice(2),
        severity: String(e.status).toLowerCase() === 'failed' ? 'error' : 'warning',
        title: e.integration?.name || e.integration || 'Ejecución fallida',
        description: e.error_message || `Trace ${e.trace_id || '—'}`,
        timestamp: e.timestamp || e.created_at || new Date().toISOString(),
      }))

    return { totalIntegrations, activeIntegrations, inactiveIntegrations, totalExecutions, successRate, errorRate, alerts }
  }, [integrations, executions])

  const filteredExecutions = useMemo(() => {
    return executions.filter((e) => {
      if (filters.integration && String(e.integration?.id || e.integration) !== String(filters.integration)) return false
      if (filters.source && String(e.source_system) !== String(filters.source)) return false
      // date filter (basic ISO compare)
      if (filters.from && new Date(e.timestamp || e.created_at) < new Date(filters.from)) return false
      if (filters.to && new Date(e.timestamp || e.created_at) > new Date(filters.to)) return false
      return true
    })
  }, [executions, filters])

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Resumen</p>
            <h2 className="section-title">Panel</h2>
          </div>
          <Badge variant="online">{loading ? 'Cargando' : 'Operativo'}</Badge>
        </div>
        <p className="section-subtitle">
          Monitorea integraciones, volumen de ejecuciones y estado de incidentes desde un único panel empresarial.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Integraciones activas" description="Conexiones en ejecución.">
          <p className="text-4xl font-semibold text-slate-900">{stats.activeIntegrations}</p>
          <p className="mt-3 text-sm text-slate-500">De {stats.totalIntegrations} integraciones registradas.</p>
        </Card>
        <Card title="Integraciones inactivas" description="Integraciones deshabilitadas o con errores.">
          <p className="text-4xl font-semibold text-slate-900">{stats.inactiveIntegrations}</p>
          <p className="mt-3 text-sm text-slate-500">Revisa configuraciones o conectividad.</p>
        </Card>
        <Card title="Ejecuciones totales" description="Mensajes procesados por el pipeline.">
          <p className="text-4xl font-semibold text-slate-900">{stats.totalExecutions}</p>
          <p className="mt-3 text-sm text-slate-500">Últimas 50 mostradas en la tabla de ejecuciones.</p>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Tasa de éxito" description="Porcentaje de ejecuciones exitosas.">
          <p className="text-4xl font-semibold text-slate-900">{stats.successRate}%</p>
          <div className="mt-3 h-2 w-full rounded bg-slate-100">
            <div className="h-2 rounded bg-emerald-500" style={{ width: `${stats.successRate}%` }} />
          </div>
        </Card>
        <Card title="Tasa de error" description="Porcentaje de ejecuciones con error.">
          <p className="text-4xl font-semibold text-slate-900">{stats.errorRate}%</p>
          <div className="mt-3 h-2 w-full rounded bg-slate-100">
            <div className="h-2 rounded bg-red-500" style={{ width: `${stats.errorRate}%` }} />
          </div>
        </Card>
        <Card title="Alertas activas" description="Incidentes detectados recientemente.">
          <p className="text-4xl font-semibold text-slate-900">{stats.alerts.length}</p>
          <p className="mt-3 text-sm text-slate-500">Últimos eventos críticos o reintentos detectados.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title="Filtros"
          description="Filtra ejecuciones por flujo, sistema origen y rango de fechas."
          actions={<>
            <select
              className="form-input"
              value={filters.integration}
              onChange={(e) => setFilters((s) => ({ ...s, integration: e.target.value }))}
            >
              <option value="">Todos los flujos</option>
              {integrations.map((it) => (
                <option key={it.id} value={it.id}>{it.name}</option>
              ))}
            </select>
            <Input id="source" label="Sistema origen" value={filters.source} onChange={(e) => setFilters((s) => ({ ...s, source: e.target.value }))} />
            <Input id="from" label="Desde" type="date" value={filters.from} onChange={(e) => setFilters((s) => ({ ...s, from: e.target.value }))} />
            <Input id="to" label="Hasta" type="date" value={filters.to} onChange={(e) => setFilters((s) => ({ ...s, to: e.target.value }))} />
          </>}
        >
          <p className="text-sm text-slate-500">Usa los controles para acotar la tabla de ejecuciones.</p>
        </Card>

        <Card title="Alertas recientes" description="Eventos que requieren atención inmediata.">
          <div className="space-y-3">
            {stats.alerts.length === 0 ? (
              <p className="text-sm text-slate-500">No hay alertas activas.</p>
            ) : (
              stats.alerts.slice(0, 5).map((a) => (
                <Alert key={a.id} variant={a.severity} title={a.title} description={`${a.description} — ${new Date(a.timestamp).toLocaleString()}`} />
              ))
            )}
          </div>
        </Card>
      </div>

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
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredExecutions.slice(0, 50).map((row) => (
              <tr key={row.trace_id || row.id}>
                <td className="font-mono text-xs">{row.trace_id || '—'}</td>
                <td className="font-medium text-slate-900">{row.integration?.name || row.integration || '—'}</td>
                <td>{row.source_system || '—'}</td>
                <td>{row.entity || row.entity_name || '—'}</td>
                <td><Badge variant={variantForStatus(row.status)}>{String(row.status || '—')}</Badge></td>
                <td>{row.retries ?? 0}</td>
                <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : (row.created_at ? new Date(row.created_at).toLocaleString() : '—')}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Dashboard
