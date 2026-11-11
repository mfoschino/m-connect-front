import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { getErrorMessage } from './platformUtils'

// Modal de confirmación reutilizable.
// onConfirm: función async que hace la acción y devuelve el mensaje de éxito.
const ConfirmActionModal = ({
  title,
  subtitle,
  warningTitle,
  warningText,
  confirmLabel,
  danger = true,
  onConfirm,
  onClose,
  onDone,
}) => {
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
      const message = await onConfirm()
      onDone(message)
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'No se pudo completar la acción.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal open title={title} subtitle={subtitle} onClose={handleClose} footer={null}>
      <form className="space-y-5" onSubmit={handleConfirm} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo completar la acción" description={submitError} />
        ) : null}

        <Alert variant={danger ? 'warning' : 'info'} title={warningTitle} description={warningText} />

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={submitting}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default ConfirmActionModal