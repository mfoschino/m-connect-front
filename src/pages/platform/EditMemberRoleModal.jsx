import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { ROLE_LABELS, getErrorMessage } from './platformUtils'

const EditMemberRoleModal = ({ tenantId, member, onClose, onDone }) => {
  const [role, setRole] = useState(member.role)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleClose = () => {
    if (!submitting) onClose()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (role === member.role) {
      onClose()
      return
    }

    setSubmitting(true)

    try {
      await platformService.updateTenantMember(tenantId, member.id, { role })
      onDone(`El rol de ${member.email} ahora es ${ROLE_LABELS[role]}.`)
    } catch (err) {
      // Si deja al tenant sin admin, el backend responde 409 con un mensaje claro
      setSubmitError(getErrorMessage(err, 'No se pudo cambiar el rol.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal open title="Cambiar rol" subtitle={member.email} onClose={handleClose} footer={null}>
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo cambiar el rol" description={submitError} />
        ) : null}

        <div className="space-y-2">
          <label htmlFor="member-role" className="block text-sm font-semibold text-slate-900">
            Rol en este tenant
          </label>
          <select
            id="member-role"
            className="form-input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            disabled={submitting}
          >
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-sm text-slate-500">
            Un tenant siempre tiene que tener al menos un administrador activo.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default EditMemberRoleModal