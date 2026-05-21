import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'

const Errors = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Errors</p>
        <h2 className="section-title">Incident dashboard</h2>
        <p className="section-subtitle">
          Review active failures, error trends, and recovery guidance in one central view.
        </p>
      </div>

      <Alert
        variant="warning"
        title="3 active error streams"
        description="Retry policies are engaged for two integrations. Review the latest traces to resolve priority issues."
      />

      <Card title="Issue summary" description="Top error classes and affected workflows.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Critical errors</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">6</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Retrying</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">2</p>
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Stable runs</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">18</p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="failed">Failed</Badge>
        <Badge variant="retrying">Retrying</Badge>
        <Badge variant="pending">Pending</Badge>
      </div>
    </div>
  )
}

export default Errors
