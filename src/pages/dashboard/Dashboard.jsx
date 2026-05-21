import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Overview</p>
            <h2 className="section-title">Dashboard</h2>
          </div>
          <Badge variant="online">Operational</Badge>
        </div>
        <p className="section-subtitle">
          Monitor integrations, execution volume, and incident status from a single enterprise dashboard.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Active integrations" description="Connections currently running.">
          <p className="text-4xl font-semibold text-slate-900">24</p>
          <p className="mt-3 text-sm text-slate-500">All systems are connected and processing traffic.</p>
        </Card>
        <Card title="Processing jobs" description="Workflows in progress.">
          <p className="text-4xl font-semibold text-slate-900">128</p>
          <p className="mt-3 text-sm text-slate-500">Current jobs are proceeding within normal limits.</p>
        </Card>
        <Card title="Incident rate" description="Errors and retries over the last 24 hours.">
          <p className="text-4xl font-semibold text-slate-900">2%</p>
          <p className="mt-3 text-sm text-slate-500">Low issue volume after automatic recovery.</p>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
