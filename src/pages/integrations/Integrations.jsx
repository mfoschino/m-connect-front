import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'

const Integrations = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Integraciones</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Fuentes conectadas</h2>
          <Badge variant="online">Red saludable</Badge>
        </div>
        <p className="section-subtitle">
          Consulta el estado de tus integraciones activas y mantén estables tus flujos de datos entre endpoints.
        </p>
      </div>

      <Card title="Estado de integraciones" description="Una vista en vivo de los sistemas conectados y la salud de sincronización.">
        <Table>
          <thead>
            <tr>
              <th>Integración</th>
              <th>Estado</th>
              <th>Última sincronización</th>
              <th>Latencia</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-slate-900">API de pagos</td>
              <td><Badge variant="online">En línea</Badge></td>
              <td>Hace 2 minutos</td>
              <td>320ms</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Conector CRM</td>
              <td><Badge variant="offline">Fuera de línea</Badge></td>
              <td>Hace 12 minutos</td>
              <td>—</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Recolector de registros</td>
              <td><Badge variant="processing">Procesando</Badge></td>
              <td>Justo ahora</td>
              <td>520ms</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Sincronización de facturación</td>
              <td><Badge variant="retrying">Reintentando</Badge></td>
              <td>Hace 4 minutos</td>
              <td>1.1s</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Integrations
