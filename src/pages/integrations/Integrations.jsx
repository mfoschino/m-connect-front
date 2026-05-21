import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'

const Integrations = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Integrations</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Connected sources</h2>
          <Badge variant="online">Network healthy</Badge>
        </div>
        <p className="section-subtitle">
          View the status of your active integrations and keep your data flows stable across endpoints.
        </p>
      </div>

      <Card title="Integration status" description="A live overview of connected systems and sync health.">
        <Table>
          <thead>
            <tr>
              <th>Integration</th>
              <th>Status</th>
              <th>Last synced</th>
              <th>Latency</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-slate-900">Payments API</td>
              <td><Badge variant="online">Online</Badge></td>
              <td>2 minutes ago</td>
              <td>320ms</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">CRM connector</td>
              <td><Badge variant="offline">Offline</Badge></td>
              <td>12 minutes ago</td>
              <td>—</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Log collector</td>
              <td><Badge variant="processing">Processing</Badge></td>
              <td>Just now</td>
              <td>520ms</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Billing sync</td>
              <td><Badge variant="retrying">Retrying</Badge></td>
              <td>4 minutes ago</td>
              <td>1.1s</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Integrations
