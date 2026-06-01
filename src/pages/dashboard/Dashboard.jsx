import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Resumen</p>
            <h2 className="section-title">Panel</h2>
          </div>
          <Badge variant="online">Operativo</Badge>
        </div>
        <p className="section-subtitle">
          Monitorea integraciones, volumen de ejecuciones y estado de incidentes desde un único panel empresarial.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Integraciones activas" description="Conexiones en ejecución.">
          <p className="text-4xl font-semibold text-slate-900">24</p>
          <p className="mt-3 text-sm text-slate-500">Todos los sistemas están conectados y procesando tráfico.</p>
        </Card>
        <Card title="Trabajos en proceso" description="Flujos de trabajo en curso.">
          <p className="text-4xl font-semibold text-slate-900">128</p>
          <p className="mt-3 text-sm text-slate-500">Los trabajos actuales avanzan dentro de los límites normales.</p>
        </Card>
        <Card title="Tasa de incidentes" description="Errores y reintentos en las últimas 24 horas.">
          <p className="text-4xl font-semibold text-slate-900">2%</p>
          <p className="mt-3 text-sm text-slate-500">Bajo volumen de incidencias tras recuperación automática.</p>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
