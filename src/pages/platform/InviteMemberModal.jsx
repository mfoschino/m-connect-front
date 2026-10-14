import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { EMAIL_PATTERN, ROLE_LABELS, getErrorMessage } from './platformUtils'

const InviteMemberModal = ({ tenantId, onClose, onDone }) => {
  // Por defecto, el rol con menos permisos
  const [form, setForm] = useState({ email: '', role: 'viewer' })
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleClose = () => {
    if (!submitting) onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    const email = form.email.trim().toLowerCase()
    if (!email) {
      setFieldErrors({ email: 'El correo electrónico es obligatorio.' })
      return
    }
    if (!EMAIL_PATTERN.test(email)) {
      setFieldErrors({ email: 'Ingresá un correo electrónico válido.' })
      return
    }
    setFieldErrors({})

    setSubmitting(true)

    try {
      await platformService.createTenantInvitation(tenantId, { email, role: form.role })
      onDone(`Se envió una invitación a ${email}.`)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo enviar la invitación.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="Invitar a este tenant"
      subtitle="La persona recibe un correo con un link para crear su cuenta o aceptar el acceso."
      onClose={handleClose}
      footer={null}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo enviar la invitación" description={submitError} />
        ) : null}

        <Input
          id="invite-email"
          label="Correo electrónico"
          type="email"
          value={form.email}
          onChange={(event) => updateField('email', event.target.value)}
          error={fieldErrors.email}
          placeholder="persona@empresa.com"
          disabled={submitting}
        />

        <div className="space-y-2">
          <label htmlFor="invite-role" className="block text-sm font-semibold text-slate-900">
            Rol
          </label>
          <select
            id="invite-role"
            className="form-input"
            value={form.role}
            onChange={(event) => updateField('role', event.target.value)}
            disabled={submitting}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Enviar invitación
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default InviteMemberModal