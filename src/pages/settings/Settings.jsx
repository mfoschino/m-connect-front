import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const Settings = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
        <h2 className="section-title">Platform configuration</h2>
        <p className="section-subtitle">
          Configure system-level settings for the M-Connect platform.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Workspace settings" description="Manage operational defaults and organizational policies.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Default region</p>
              <p className="mt-1">US East</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Timezone</p>
              <p className="mt-1">America/New_York</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Data retention</p>
              <p className="mt-1">90 days for audit logs</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="secondary">Edit workspace</Button>
          </div>
        </Card>

        <Card title="Notification preferences" description="Adjust how the platform notifies your team.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Alerts</p>
              <p className="mt-1">Email and in-app notifications enabled.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Digest cadence</p>
              <p className="mt-1">Daily summary at 8:00 AM.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">System health</p>
              <p className="mt-1">Operational status alerts active.</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="outline">Review notification rules</Button>
          </div>
        </Card>

        <Card title="Compliance" description="Review platform-level security and compliance controls.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Session policy</p>
              <p className="mt-1">Idle sessions expire after 30 minutes.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Access control</p>
              <p className="mt-1">Role-based access configured for your team.</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="outline">Review compliance</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Settings
