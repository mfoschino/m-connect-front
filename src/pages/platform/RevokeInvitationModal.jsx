import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { getErrorMessage } from './platformUtils'

const RevokeInvitationModal = ({ tenantId, invitation, onClose, onDone }) => {
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleClose = () => {
    if (!submitting) onClose()
  }

  const handleConfirm = async (event) => {
    event.preventDefault()
    setSubmitError('')
    setSubmitting(true)

    try {
      // TODO: llamá al servicio que revoca la invitación
      await platformService.cancelTenantInvitation(tenantId, invitation.id)

      onDone(`Se revocó la invitación a ${invitation.email}.`)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo revocar la invitación.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal open title="Revocar invitación" subtitle={invitation.email} onClose={handleClose} footer={null}>
      <form className="space-y-5" onSubmit={handleConfirm} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo completar la acción" description={submitError} />
        ) : null}

        <Alert
          variant="warning"
          title="El link de la invitación va a dejar de funcionar"
          description="Si después cambiás de idea, vas a tener que enviar una invitación nueva."
        />

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" loading={submitting}>
            Revocar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default RevokeInvitationModal