import { Link } from 'react-router-dom'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Button from '../ui/Button'

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const TiendaNubeRunPanel = ({
  integration,
  readiness,
  runLoading,
  runFeedback,
  onRun,
  onEditIntegration,
  onOpenProfiles,
  onOpenLookupTables,
}) => {
  if (!isObject(integration) || !isObject(readiness)) return null

  const checks = Array.isArray(readiness.checks) ? readiness.checks.filter(isObject) : []
  const missingChecks = Array.isArray(readiness.missingChecks)
    ? readiness.missingChecks.filter(isObject)
    : []
  const canRun = readiness.canRun === true
  const fullyReady = readiness.fullyReady === true
  const missingActions = new Set(missingChecks.map((check) => check.action).filter(Boolean))

  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            Ejecución guiada
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">
            Tienda Nube → pedido de venta canónico → Finnegans
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            Documento: <strong>{readiness.documentLabel}</strong>
          </p>
          <p className="mt-1 font-mono text-xs text-slate-600">
            POST /integrations/{integration.id}/run
          </p>
        </div>
        <Badge variant={fullyReady ? 'online' : canRun ? 'retrying' : 'failed'}>
          {fullyReady ? 'Lista para ejecutar' : canRun ? 'Requiere revisión' : 'Configuración crítica pendiente'}
        </Badge>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <li
            key={check.id}
            className={`rounded-2xl border px-3 py-2 text-sm ${
              check.ready
                ? 'border-emerald-200 bg-white text-emerald-800'
                : check.blocking
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <span aria-hidden="true">{check.ready ? '✓' : '!'}</span>{' '}
            {check.label}
          </li>
        ))}
      </ul>

      {missingChecks.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {missingActions.has('integration') ? (
            <Button type="button" variant="outline" onClick={onEditIntegration}>
              Editar integración
            </Button>
          ) : null}
          {missingActions.has('lookup') ? (
            <Button type="button" variant="outline" onClick={onOpenLookupTables}>
              Ir a tablas de consulta
            </Button>
          ) : null}
          {missingActions.has('profile') ? (
            <Button type="button" variant="outline" onClick={onOpenProfiles}>
              Ir a perfiles
            </Button>
          ) : null}
          {missingActions.has('credentials') ? (
            <Link className="btn btn-outline" to="/settings">
              Configurar credenciales
            </Link>
          ) : null}
        </div>
      ) : null}

      {runFeedback?.message ? (
        <div className="mt-4 space-y-3">
          <Alert
            variant={runFeedback.type === 'success' ? 'success' : 'error'}
            title={runFeedback.type === 'success' ? 'Ejecución iniciada' : 'No se pudo iniciar la ejecución'}
            description={runFeedback.message}
          />
          {runFeedback.taskId ? (
            <p className="text-sm text-slate-700">
              ID de tarea: <code className="break-all rounded bg-white px-2 py-1">{runFeedback.taskId}</code>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            {runFeedback.traceId ? (
              <Link className="text-sky-700 underline" to={`/executions/${runFeedback.traceId}`}>
                Ver detalle de ejecución
              </Link>
            ) : runFeedback.type === 'success' ? (
              <>
                <Link className="text-sky-700 underline" to="/executions">
                  Ver listado de ejecuciones
                </Link>
                <span className="font-normal text-slate-600">
                  La ejecución devuelve una tarea; los mensajes aparecerán en el listado al procesarse.
                </span>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-sky-200 pt-4">
        <Button
          type="button"
          onClick={onRun}
          loading={runLoading}
          disabled={!canRun}
        >
          Ejecutar integración
        </Button>
        <Link className="text-sm font-semibold text-sky-700 underline" to="/executions">
          Abrir ejecuciones
        </Link>
      </div>
    </div>
  )
}

export default TiendaNubeRunPanel
