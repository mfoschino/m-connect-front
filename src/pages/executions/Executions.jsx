import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'

const Executions = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Executions</p>
        <h2 className="section-title">Pipeline activity</h2>
        <p className="section-subtitle">
          Track recent execution runs, identify slowdowns, and monitor status across your workflows.
        </p>
      </div>

      <Card title="Recent execution runs" description="Latest pipelines and their current state.">
        <Table>
          <thead>
            <tr>
              <th>Pipeline</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-medium text-slate-900">Order sync</td>
              <td><Badge variant="online">Success</Badge></td>
              <td>1m 12s</td>
              <td>3 minutes ago</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Invoice sync</td>
              <td><Badge variant="failed">Failed</Badge></td>
              <td>45s</td>
              <td>8 minutes ago</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">User import</td>
              <td><Badge variant="processing">Processing</Badge></td>
              <td>—</td>
              <td>Just now</td>
            </tr>
            <tr>
              <td className="font-medium text-slate-900">Alert delivery</td>
              <td><Badge variant="pending">Pending</Badge></td>
              <td>—</td>
              <td>1 minute ago</td>
            </tr>
          </tbody>
        </Table>
      </Card>
    </div>
  )
}

export default Executions
