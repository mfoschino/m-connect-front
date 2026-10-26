import { useState } from 'react'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import platformService from '../../services/api/platformService'
import { getErrorMessage } from './platformUtils'

const TenantStatusModal = ({ tenant, onClose, onDone }) => {
  // Si está activo, la acción es suspender; si no, reactivar
  const suspending = tenant.is_active

  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleClose = () => {
    if (!submitting) onClose()
  }

  const handleConfirm = async (event) => {
    event.preventDefault()
    setSubmitError('')

    const trimmedReason = reason.trim()
    if (suspending && trimmedReason.length < 5) {
      setReasonError('Contá brevemente el motivo (mínimo 5 caracteres).')
      return
    }
    setReasonError('')

    const payload = suspending
      ? { is_active: false, suspended_reason: trimmedReason }
      : { is_active: true }

    setSubmitting(true)

    try {
      await platformService.updateTenant(tenant.id, payload)
      onDone(suspending ? `${tenant.name} fue suspendido.` : `${tenant.name} fue reactivado.`)
    } catch (err) {
      setSubmitError(
        getErrorMessage(err, suspending ? 'No se pudo suspender el tenant.' : 'No se pudo reactivar el tenant.'),
      )
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      title={suspending ? 'Suspender tenant' : 'Reactivar tenant'}
      subtitle={tenant.name}
      onClose={handleClose}
      footer={null}
    >
      <form className="space-y-5" onSubmit={handleConfirm} noValidate>
        {submitError ? (
          <Alert variant="error" title="No se pudo completar la acción" description={submitError} />
        ) : null}

        {suspending ? (
          <>
            <Alert
              variant="warning"
              title="Esta acción corta el acceso"
              description={`Todos los usuarios de ${tenant.name} van a perder el acceso de inmediato. Podés reactivarlo más adelante.`}
            />
            <div className="space-y-2">
              <label htmlFor="suspend-reason" className="block text-sm font-semibold text-slate-900">
                Motivo de la suspensión
              </label>
              <textarea
                id="suspend-reason"
                className={`form-input min-h-24 ${reasonError ? 'input-error' : ''}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ej: falta de pago, pedido del cliente..."
                disabled={submitting}
              />
              {reasonError ? <p className="text-sm font-medium text-red-600">{reasonError}</p> : null}
            </div>
          </>
        ) : (
          <div className="space-y-3 text-sm text-slate-700">
            <p>Los usuarios de {tenant.name} van a recuperar el acceso.</p>
            {tenant.suspended_reason ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-3">
                Motivo de la suspensión: {tenant.suspended_reason}
              </p>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" variant={suspending ? 'danger' : 'primary'} loading={submitting}>
            {suspending ? 'Suspender' : 'Reactivar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default TenantStatusModal