import { useEffect, useState } from 'react'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Card from '../ui/Card'

const PasswordForm = ({ onSave, status }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (status.type === 'success') {
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setErrors({})
    }
  }, [status.type])

  const handleChange = (field) => (event) => {
    setFormData({ ...formData, [field]: event.target.value })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = {}
    if (!formData.currentPassword) {
      nextErrors.currentPassword = 'Ingresa tu contraseña actual.'
    }
    if (!formData.newPassword) {
      nextErrors.newPassword = 'Ingresa una nueva contraseña.'
    } else if (formData.newPassword.length < 8) {
      nextErrors.newPassword = 'La contraseña debe tener al menos 8 caracteres.'
    }
    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirma tu nueva contraseña.'
    } else if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    await onSave(formData)
  }

  return (
    <div id="security">
      <Card title="Seguridad" description="Actualiza tu contraseña para mantener tu cuenta protegida.">
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Contraseña actual</span>
          <input
            type="password"
            value={formData.currentPassword}
            onChange={handleChange('currentPassword')}
            className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Contraseña actual"
          />
          {errors.currentPassword ? <p className="mt-2 text-sm text-rose-600">{errors.currentPassword}</p> : null}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Nueva contraseña</span>
          <input
            type="password"
            value={formData.newPassword}
            onChange={handleChange('newPassword')}
            className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Nueva contraseña"
          />
          {errors.newPassword ? <p className="mt-2 text-sm text-rose-600">{errors.newPassword}</p> : null}
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-900">Confirmar nueva contraseña</span>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange('confirmPassword')}
            className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Repite la nueva contraseña"
          />
          {errors.confirmPassword ? <p className="mt-2 text-sm text-rose-600">{errors.confirmPassword}</p> : null}
        </label>

        {status.message ? (
          <Alert
            variant={status.type === 'success' ? 'success' : 'error'}
            title={status.type === 'success' ? 'Éxito' : 'Error'}
            description={status.message}
          />
        ) : null}

        <div className="flex justify-end">
          <Button loading={status.loading} type="submit">
            Actualizar contraseña
          </Button>
        </div>
      </form>
    </Card>
  </div>
)
}

export default PasswordForm
