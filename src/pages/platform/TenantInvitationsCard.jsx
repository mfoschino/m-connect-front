import { useEffect, useState } from 'react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Table from '../../components/ui/Table'
import platformService from '../../services/api/platformService'
import { ROLE_LABELS, formatDate, getErrorMessage } from './platformUtils'
import Button from '../../components/ui/Button'
import InviteMemberModal from './InviteMemberModal'
import RevokeInvitationModal from './RevokeInvitationModal'

const STATUS_LABELS = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  revoked: 'Revocada',
  expired: 'Vencida',
}

const STATUS_VARIANTS = {
  pending: 'pending',
  accepted: 'online',
  revoked: 'offline',
  expired: 'failed',
}

const TenantInvitationsCard = ({ tenantId, tenantActive }) => {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [revokingInvitation, setRevokingInvitation] = useState(null)
  const [resendingId, setResendingId] = useState('')

  useEffect(() => {
    let cancelled = false

    platformService
      .listTenantInvitations(tenantId)
      .then((response) => {
        if (cancelled) return
        setInvitations(Array.isArray(response.data) ? response.data : [])
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setError(getErrorMessage(err, 'No se pudieron cargar las invitaciones.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tenantId, reload])

  const pendingCount = invitations.filter((invitation) => invitation.status === 'pending').length
  const handleDone = (message) => {
    setInviteOpen(false)
    setRevokingInvitation(null)
    setActionError('')
    setSuccessMessage(message)
    setReload((current) => current + 1)
  }

  // Reenviar no abre modal: actúa directamente
  const handleResend = async (invitation) => {
    setResendingId(invitation.id)
    setActionError('')
    setSuccessMessage('')

    try {
      await platformService.resendTenantInvitation(tenantId, invitation.id)
      setSuccessMessage(
        `Se reenvió la invitación a ${invitation.email}. El link del correo anterior ya no funciona.`,
      )
      setReload((current) => current + 1)
    } catch (err) {
      // Si se reenvió hace menos de 60 segundos, el backend responde 429 con su mensaje
      setActionError(getErrorMessage(err, 'No se pudo reenviar la invitación.'))
    } finally {
      setResendingId('')
    }
  }

  return (
    <Card
      title="Invitaciones"
      description={
        loading
          ? 'Personas invitadas a este tenant.'
          : `${invitations.length} en total, ${pendingCount} pendientes.`
      }
      actions={
        <Button onClick={() => setInviteOpen(true)} disabled={!tenantActive}>
          Invitar
        </Button>
      }
    >
      {!tenantActive ? (
        <div className="mb-4">
          <Alert
            variant="warning"
            title="Tenant suspendido"
            description="No se pueden enviar ni reenviar invitaciones mientras el tenant esté suspendido."
          />
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-4">
          <Alert
            variant="success"
            title="Operación completada"
            description={successMessage}
            onClose={() => setSuccessMessage('')}
          />
        </div>
      ) : null}

      {actionError ? (
        <div className="mb-4">
          <Alert
            variant="error"
            title="No se pudo completar la acción"
            description={actionError}
            onClose={() => setActionError('')}
          />
        </div>
      ) : null}

      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="No se pudieron cargar las invitaciones" description={error} />
        </div>
      ) : null}

      <Table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Último envío</th>
            <th>Vence</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan="6" className="text-center text-sm text-slate-500">Cargando invitaciones...</td>
            </tr>
          ) : invitations.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center text-sm text-slate-500">
                Este tenant no tiene invitaciones.
              </td>
            </tr>
          ) : (
            invitations.map((invitation) => (
              <tr key={invitation.id}>
                <td className="font-medium text-slate-900">{invitation.email}</td>
                <td>{ROLE_LABELS[invitation.role] || invitation.role || '—'}</td>
                <td>
                  <Badge variant={STATUS_VARIANTS[invitation.status] || 'pending'}>
                    {STATUS_LABELS[invitation.status] || invitation.status}
                  </Badge>
                </td>
                <td>
                  {formatDate(invitation.last_sent_at)}
                  {invitation.send_count > 1 ? (
                    <p className="text-xs text-slate-500">Enviada {invitation.send_count} veces</p>
                  ) : null}
                </td>
                <td>{invitation.status === 'pending' ? formatDate(invitation.expires_at) : '—'}</td>
                <td>
                  {invitation.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        className="rounded-full px-3 py-1 text-sm"
                        onClick={() => handleResend(invitation)}
                        loading={resendingId === invitation.id}
                        disabled={!tenantActive || Boolean(resendingId)}
                      >
                        Reenviar
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-full px-3 py-1 text-sm text-rose-600"
                        onClick={() => setRevokingInvitation(invitation)}
                        disabled={Boolean(resendingId)}
                      >
                        Revocar
                      </Button>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
      {inviteOpen ? (
        <InviteMemberModal
          tenantId={tenantId}
          onClose={() => setInviteOpen(false)}
          onDone={handleDone}
        />
      ) : null}

      {revokingInvitation ? (
        <RevokeInvitationModal
          tenantId={tenantId}
          invitation={revokingInvitation}
          onClose={() => setRevokingInvitation(null)}
          onDone={handleDone}
        />
      ) : null}
    </Card>
  )
}

export default TenantInvitationsCard