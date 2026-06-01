import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'

const Executions = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Ejecuciones</p>
        <h2 className="section-title">Actividad de pipelines</h2>
        <p className="section-subtitle">
          Haz seguimiento de ejecuciones recientes, detecta lentitudes y monitorea el estado de tus flujos de trabajo.
        </p>
      </div>

      <Card title="Ejecuciones recientes" description="Pipelines más recientes y su estado actual.">
        <Table>
          <thead>
            <tr>
              <th>Flujo</th>
              <th>Estado</th>
              <th>Duración</th>
              <th>Inicio</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-slate-900">Sincronización de pedidos</td>
              <td><Badge variant="online">Éxito</Badge></td>
              <td>1m 12s</td>
              <td>Hace 3 minutos</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Sincronización de facturas</td>
              <td><Badge variant="failed">Fallido</Badge></td>
              <td>45s</td>
              <td>Hace 8 minutos</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Importación de usuarios</td>
              <td><Badge variant="processing">Procesando</Badge></td>
              <td>—</td>
              <td>Justo ahora</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Entrega de alertas</td>
              <td><Badge variant="pending">Pendiente</Badge></td>
              <td>—</td>
              <td>Hace 1 minuto</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Executions
