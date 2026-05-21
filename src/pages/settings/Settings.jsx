import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const Settings = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Settings</p>
        <h2 className="section-title">Platform configuration</h2>
        <p className="section-subtitle">
          Manage your workspace preferences, notification rules, and identity settings.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Account settings" description="Basic profile and identity settings.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Organization</p>
              <p className="mt-1">M-Connect Operations</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Primary contact</p>
              <p className="mt-1">admin@m-connect.com</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="secondary">Update profile</Button>
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
          </div>
          <div className="mt-6">
            <Button variant="outline">Review alert rules</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Settings
