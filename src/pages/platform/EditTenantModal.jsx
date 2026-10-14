import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { PLAN_OPTIONS, getErrorMessage } from './platformUtils'

const EditTenantModal = ({ tenant, onClose, onSaved }) => {
  // El formulario arranca con los datos actuales del tenant
  const [form, setForm] = useState({
    name: tenant.name ?? '',
    plan: tenant.plan ?? PLAN_OPTIONS[0].value,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Si el tenant tiene un plan que no está en la lista, lo agregamos para no perderlo
  const planOptions =
    !tenant.plan || PLAN_OPTIONS.some((option) => option.value === tenant.plan)
      ? PLAN_OPTIONS
      : [...PLAN_OPTIONS, { value: tenant.plan, label: tenant.plan }]

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleClose = () => {
    if (!submitting) onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    const name = form.name.trim()
    if (!name) {
      setFieldErrors({ name: 'El nombre es obligatorio.' })
      return
    }
    setFieldErrors({})

    // Solo mandamos al backend lo que cambió
    const changes = {}
    if (name !== tenant.name) changes.name = name
    if (form.plan !== tenant.plan) changes.plan = form.plan

    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }

    setSubmitting(true)

    try {
      const response = await platformService.updateTenant(tenant.id, changes)
      onSaved(`${response.data?.name ?? name} se actualizó correctamente.`)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo actualizar el tenant.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal open title="Editar tenant" subtitle={tenant.name} onClose={handleClose} footer={null}>
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo guardar" description={submitError} />
        ) : null}

        <Input
          id="edit-tenant-name"
          label="Nombre"
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
          error={fieldErrors.name}
          disabled={submitting}
        />

        <div className="space-y-2">
          <label htmlFor="edit-tenant-plan" className="block text-sm font-semibold text-slate-900">
            Plan
          </label>
          <select
            id="edit-tenant-plan"
            className="form-input"
            value={form.plan}
            onChange={(event) => updateField('plan', event.target.value)}
            disabled={submitting}
          >
            {planOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default EditTenantModal