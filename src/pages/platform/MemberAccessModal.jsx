import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { getErrorMessage } from './platformUtils'

const MemberAccessModal = ({ tenantId, member, onClose, onDone }) => {
  // TODO 1: ¿la acción es deshabilitar? Calculalo a partir de member.is_active
  const disabling = member.is_active

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
      // TODO 2: llamá a platformService.updateTenantMember con lo que corresponda
      await platformService.updateTenantMember(tenantId, member.id, {is_active: !member.is_active})

      // TODO 3: avisá con un mensaje distinto según si se deshabilitó o se habilitó
      onDone(
        disabling
            ? `Se deshabilitó el acceso de ${member.email}.`
            : `Se hablitó el acceso de ${member.email}`
      )
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo cambiar el acceso.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={disabling ? 'Deshabilitar acceso' : 'Habilitar acceso'}
      subtitle={member.email}
      onClose={handleClose}
      footer={null}
    >
      <form className="space-y-5" onSubmit={handleConfirm} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo completar la acción" description={submitError} />
        ) : null}

        {disabling ? (
          <Alert
            variant="warning"
            title="Esta persona va a perder el acceso"
            description="No va a poder entrar a este tenant hasta que vuelvas a habilitarla. Su cuenta y sus accesos a otros tenants no cambian."
          />
        ) : (
          <p className="text-sm text-slate-700">
            Esta persona va a recuperar el acceso a este tenant con el mismo rol que tenía.
          </p>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant={disabling ? 'danger' : 'primary'} loading={submitting}>
            {disabling ? 'Deshabilitar' : 'Habilitar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default MemberAccessModal