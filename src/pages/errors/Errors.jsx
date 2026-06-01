import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

const Errors = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Incidentes</p>
        <h2 className="section-title">Panel de incidentes</h2>
        <p className="section-subtitle">
          Revisa fallos activos, tendencias de errores y recomendaciones de recuperación en una vista central.
        </p>
      </div>

      <Alert
        variant="warning"
        title="3 flujos de errores activos"
        description="Se han activado políticas de reintento para dos integraciones. Revisa las últimas trazas para resolver los problemas prioritarios."
      />

      <Card title="Resumen de incidencias" description="Principales clases de error y flujos afectados.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Errores críticos</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">6</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Reintentando</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">2</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Ejecuciones estables</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">18</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="failed">Fallido</Badge>
        <Badge variant="retrying">Reintentando</Badge>
        <Badge variant="pending">Pendiente</Badge>
      </div>
    </div>
  )
}

export default Errors
