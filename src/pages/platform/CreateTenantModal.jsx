import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { EMAIL_PATTERN, PLAN_OPTIONS, getErrorMessage } from './platformUtils'


const initialForm = { name: '', plan: 'free', admin_email: '' }

// Revisa el formulario y devuelve los errores encontrados (vacío si está todo bien)
const validate = (form) => {
  const errors = {}

  if (!form.name.trim()) {
    errors.name = 'El nombre es obligatorio.'
  }

  const email = form.admin_email.trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    errors.admin_email = 'Ingresá un correo electrónico válido.'
  }

  return errors
}

const CreateTenantModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleClose = () => {
    // Mientras se está enviando, no se puede cerrar
    if (!submitting) onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    const errors = validate(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    // Armamos lo que se envía al backend
    const payload = { name: form.name.trim(), plan: form.plan }
    const adminEmail = form.admin_email.trim().toLowerCase()
    if (adminEmail) {
      payload.admin_email = adminEmail
    }

    setSubmitting(true)

    try {
      const response = await platformService.createTenant(payload)
      onCreated(response.data)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo crear el tenant.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title="Nuevo tenant"
      subtitle="Creá una organización y, si querés, invitá a su primer administrador."
      onClose={handleClose}
      footer={null}
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo crear el tenant" description={submitError} />
        ) : null}

        <Input
          id="tenant-name"
          label="Nombre"
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
          error={fieldErrors.name}
          placeholder="Ej: Acme Corp"
          disabled={submitting}
        />

        <div className="space-y-2">
          <label htmlFor="tenant-plan" className="block text-sm font-semibold text-slate-900">
            Plan
          </label>
          <select
            id="tenant-plan"
            className="form-input"
            value={form.plan}
            onChange={(event) => updateField('plan', event.target.value)}
            disabled={submitting}
          >
            {PLAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Input
            id="tenant-admin-email"
            label="Email del primer administrador (opcional)"
            type="email"
            value={form.admin_email}
            onChange={(event) => updateField('admin_email', event.target.value)}
            error={fieldErrors.admin_email}
            placeholder="admin@empresa.com"
            disabled={submitting}
          />
          <p className="text-sm text-slate-500">
            Si lo completás, se le envía una invitación por correo para unirse como administrador.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Crear tenant
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateTenantModal