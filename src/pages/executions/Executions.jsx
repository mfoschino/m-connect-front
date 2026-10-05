import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import executionService from '../../services/api/executionService'
import { getExecutionIdentifier } from '../../services/adapters/executionAdapter'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Table from '../../components/ui/Table'
import { getExecutionStatusLabel } from '../../utils/presentationUtils'
import { loadMonitorRequest } from './loadMonitorRequest'

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

const Executions = () => {
  const [monitor, setMonitor] = useState({ data: [], loading: true, error: null })
  const [options, setOptions] = useState({ data: [], loading: true, error: null })
  const [search, setSearch] = useState('')
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('')
  const executionRequestRef = useRef(0)
  const integrationRequestRef = useRef(0)

  const fetchExecutions = useCallback((integrationId) => loadMonitorRequest({
    requestRef: executionRequestRef,
    load: () => executionService.listExecutions({ integration_id: integrationId }),
    onChange: setMonitor,
    errorMessage: 'No se pudieron cargar las ejecuciones. Intenta recargar.',
  }), [])

  const fetchIntegrations = useCallback(() => loadMonitorRequest({
    requestRef: integrationRequestRef,
    load: () => executionService.listIntegrations(),
    onChange: setOptions,
    errorMessage: 'No se pudieron cargar las integraciones.',
  }), [])

  const handleIntegrationChange = (integrationId) => {
    setSelectedIntegrationId(integrationId)
    fetchExecutions(integrationId)
  }

  useEffect(() => {
    fetchExecutions()
    fetchIntegrations()

    return () => {
      executionRequestRef.current += 1
      integrationRequestRef.current += 1
    }
  }, [fetchExecutions, fetchIntegrations])

  return (
    <ExecutionsContent
      monitor={monitor}
      options={options}
      search={search}
      selectedIntegrationId={selectedIntegrationId}
      onSearchChange={setSearch}
      onIntegrationChange={handleIntegrationChange}
      onRefresh={() => {
        fetchExecutions(selectedIntegrationId)
        fetchIntegrations()
      }}
      onRetryIntegrations={fetchIntegrations}
    />
  )
}

export const ExecutionsContent = ({
  monitor,
  options,
  search,
  selectedIntegrationId,
  onSearchChange,
  onIntegrationChange,
  onRefresh,
  onRetryIntegrations,
}) => {
  const { data: executions, loading, error } = monitor
  const { data: integrations, loading: integrationsLoading, error: integrationsError } = options

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

  const missingIntegration = selectedIntegrationId
    && !integrations.some((integration) => integration.id === selectedIntegrationId)
  const emptyMessage = search.trim()
    ? 'No hay ejecuciones que coincidan con los filtros actuales.'
    : selectedIntegrationId
      ? 'No hay ejecuciones para la integración seleccionada.'
      : 'No hay ejecuciones.'

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
          <Button onClick={onRefresh} loading={loading}>
            Refrescar
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            id="execution-search"
            label="Buscar ejecuciones"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ID de seguimiento, integración, entidad..."
          />
          <div className="space-y-2">
            <label htmlFor="execution-integration" className="block text-sm font-semibold text-slate-900">
              Integración
            </label>
            <select
              id="execution-integration"
              className="form-input w-full"
              value={selectedIntegrationId}
              onChange={(e) => onIntegrationChange(e.target.value)}
              aria-busy={integrationsLoading}
              aria-describedby={integrationsLoading || integrationsError ? 'execution-integration-status' : undefined}
            >
              <option value="">Todas las integraciones</option>
              {missingIntegration ? (
                <option value={selectedIntegrationId}>Integración no disponible — {selectedIntegrationId}</option>
              ) : null}
              {integrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name || integration.id}{integration.is_active === false ? ' — inactiva' : ''}
                </option>
              ))}
            </select>
            {integrationsLoading ? (
              <p id="execution-integration-status" role="status" className="text-sm text-slate-500">Cargando integraciones...</p>
            ) : integrationsError ? (
              <div id="execution-integration-status" className="space-y-2">
                <p role="alert" className="text-sm font-medium text-red-600">{integrationsError}</p>
                <Button variant="outline" onClick={onRetryIntegrations}>Reintentar integraciones</Button>
              </div>
            ) : null}
          </div>
        </div>
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
            {loading || error || filteredExecutions.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-sm text-slate-500">
                  {loading ? (
                    <span role="status">Cargando ejecuciones...</span>
                  ) : error ? (
                    <span role="alert" className="font-medium text-red-600">{error}</span>
                  ) : emptyMessage}
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
