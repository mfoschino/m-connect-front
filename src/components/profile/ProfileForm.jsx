import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card from '../ui/Card'
import AvatarUploader from './AvatarUploader'

const ProfileForm = ({ profile, onChange, onSave, status }) => {
  const handleFieldChange = (field) => (event) => {
    onChange({ ...profile, [field]: event.target.value })
  }

  const onAvatarChange = (nextAvatarUrl) => {
    onChange({ ...profile, avatarUrl: nextAvatarUrl })
  }

  return (
    <Card title="Información personal" description="Actualiza tu nombre, email y avatar de perfil.">
      <div className="space-y-6">
        <AvatarUploader
          avatarUrl={profile.avatarUrl}
          displayName={profile.name || profile.email}
          onChange={onAvatarChange}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Nombre</span>
            <input
              type="text"
              value={profile.name}
              onChange={handleFieldChange('name')}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Tu nombre completo"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-900">Email</span>
            <input
              type="email"
              value={profile.email}
              onChange={handleFieldChange('email')}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="correo@empresa.com"
            />
          </label>
        </div>

        {status.message ? (
          <Alert
            variant={status.type === 'success' ? 'success' : status.type === 'error' ? 'error' : 'info'}
            title={status.type === 'success' ? 'Perfil actualizado' : 'Información'}
            description={status.message}
          />
        ) : null}

        <div className="flex justify-end">
          <Button loading={status.loading} onClick={() => onSave(profile)}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ProfileForm
