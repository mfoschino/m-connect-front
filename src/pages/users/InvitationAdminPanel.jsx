import { useEffect, useRef, useState } from 'react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import invitationAdminService from '../../services/api/invitationAdminService'
import { getIamPermissions } from '../../services/auth/iamPermissions'
import { createInvitationActionGate, createInvitationReadFlow,
  initialInvitationReadState, invitationErrorMessage,
  validateInvitationDraft } from '../../services/invitationAdminFlow'

const statuses = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'accepted', label: 'Aceptada' },
  { value: 'revoked', label: 'Revocada' },
  { value: 'expired', label: 'Vencida' },
]

const statusVariant = { pending: 'pending', accepted: 'online',
  revoked: 'offline', expired: 'failed' }

const roles = [
  { value: 'viewer', label: 'Visualizador' },
  { value: 'operator', label: 'Operador' },
  { value: 'admin', label: 'Administrador' },
]

const formatDate = (value) => {
  if (!value) return 'Sin registro'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin registro'
    : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const InvitationRow = ({ invitation, pending, onResend, onRevoke }) => {
  const status = statuses.find((item) => item.value === invitation.status)
  const role = roles.find((item) => item.value === invitation.role)
  return (
    <tr>
      <td>{invitation.email}</td>
      <td>{role?.label || invitation.role}</td>
      <td><Badge variant={statusVariant[invitation.status] || 'offline'}>
        {status?.label || invitation.status}</Badge></td>
      <td>{formatDate(invitation.created_at)}</td>
      <td>{formatDate(invitation.expires_at)}</td>
      <td>
        {invitation.status === 'pending' ? <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" disabled={Boolean(pending)}
            loading={pending === `resend:${invitation.id}`}
            onClick={() => onResend(invitation)}>Reenviar</Button>
          <Button type="button" variant="ghost" disabled={Boolean(pending)}
            loading={pending === `revoke:${invitation.id}`}
            onClick={() => onRevoke(invitation)}>Revocar</Button>
        </div> : <span className="text-slate-500">Sin acciones</span>}
      </td>
    </tr>
  )
}

const InvitationAdminPanel = () => {
  const auth = useAuth()
  const authRef = useRef(auth)
  const flowRef = useRef(null)
  const gateRef = useRef(null)
  const [directory, setDirectory] = useState(initialInvitationReadState)
  const [showCreate, setShowCreate] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('operator')
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState('')
  const canAdmin = getIamPermissions(auth).canViewUserAdmin

  useEffect(() => { authRef.current = auth }, [auth])

  useEffect(() => {
    if (!canAdmin) return undefined
    const contextId = auth.contextId
    const tenantId = auth.user.tenant_id
    const isCurrent = () => authRef.current.contextId === contextId
      && authRef.current.user?.tenant_id === tenantId
    const isAllowed = () => getIamPermissions(authRef.current).canViewUserAdmin
    const flow = createInvitationReadFlow({
      getInvitations: invitationAdminService.getInvitations, onChange: setDirectory,
    })
    const gate = createInvitationActionGate({ isAllowed, isCurrent, onPendingChange: setPending })
    flowRef.current = flow
    gateRef.current = gate
    flow.refresh()
    return () => {
      flow.dispose()
      gate.dispose()
      if (flowRef.current === flow) flowRef.current = null
      if (gateRef.current === gate) gateRef.current = null
    }
  }, [auth.contextId, auth.user?.tenant_id, canAdmin])

  const canAct = () => getIamPermissions(authRef.current).canViewUserAdmin

  const submitCreate = async (event) => {
    event.preventDefault()
    if (!canAct()) { setFormError('Ya no tenés permiso para administrar invitaciones.'); return }
    const draft = validateInvitationDraft({ email, role })
    if (draft.error) { setFormError(draft.error); return }
    setFormError('')
    setSuccess('')
    const result = await gateRef.current?.run('create',
      () => invitationAdminService.createInvitation(draft.value), 201)
    if (!result || result.kind === 'stale' || result.kind === 'blocked') return
    if (result.kind === 'success') {
      setShowCreate(false)
      setEmail('')
      setRole('operator')
      setSuccess('La invitación fue registrada para su envío.')
      await flowRef.current?.refresh(undefined, { force: true })
    } else {
      setFormError(result.kind === 'error'
        ? invitationErrorMessage(result.error, 'create')
        : 'No se pudo confirmar la creación. Revisá el listado antes de volver a intentar.')
    }
  }

  const runExistingAction = async (invitation, action) => {
    if (!canAct()) { setActionError('Ya no tenés permiso para administrar invitaciones.'); return }
    if (gateRef.current?.getPending()) return
    if (invitation?.status !== 'pending' || !invitation?.id) return
    if (action === 'revoke' && !window.confirm(
      `¿Revocar la invitación de ${invitation.email}? Su enlace pendiente dejará de ser válido.`)) return
    setActionError('')
    setSuccess('')
    const operation = action === 'resend'
      ? () => invitationAdminService.resendInvitation(invitation.id)
      : () => invitationAdminService.revokeInvitation(invitation.id)
    const result = await gateRef.current?.run(`${action}:${invitation.id}`, operation,
      action === 'resend' ? 200 : 204)
    if (!result || result.kind === 'stale' || result.kind === 'blocked') return
    if (result.kind === 'success') {
      setSuccess(action === 'resend'
        ? 'El reenvío fue registrado para su envío. El enlace anterior dejó de ser válido.'
        : 'La invitación fue revocada. Su enlace pendiente dejó de ser válido.')
      await flowRef.current?.refresh(undefined, { force: true })
    } else {
      setActionError(result.kind === 'error'
        ? invitationErrorMessage(result.error, action)
        : 'No se pudo confirmar el resultado. Revisá el listado antes de volver a intentar.')
      if (result.kind === 'error' && [404, 409].includes(result.error?.response?.status)) {
        await flowRef.current?.refresh(undefined, { force: true })
      }
    }
  }

  if (!canAdmin) return <Alert variant="warning" title="Acceso administrativo requerido"
    description="Las invitaciones requieren rol de administrador en la organización activa." />

  return <div className="space-y-5">
    {success ? <Alert variant="success" title="Operación confirmada" description={success}
      onClose={() => setSuccess('')} /> : null}
    {actionError ? <Alert variant="error" title="No se pudo completar la acción"
      description={actionError} onClose={() => setActionError('')} /> : null}

    <Card title="Invitaciones" description="Invitaciones de la organización activa, ordenadas de la más reciente a la más antigua."
      actions={<div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => flowRef.current?.refresh()}
          loading={directory.loading || directory.loadingMore}>Refrescar</Button>
        <Button type="button" onClick={() => { setFormError(''); setShowCreate(true) }}
          disabled={Boolean(pending)}>Crear invitación</Button>
      </div>}>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
        Estado
        <select className="form-input" value={directory.statusFilter}
          onChange={(event) => flowRef.current?.setStatus(event.target.value)}>
          {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {directory.error ? <Alert variant="error" title="No se pudo cargar el listado"
        description={directory.error} /> : null}
      <Table>
        <thead><tr><th>Email</th><th>Rol</th><th>Estado</th><th>Creada</th>
          <th>Vence</th><th>Acciones</th></tr></thead>
        <tbody>
          {directory.loading ? <tr><td colSpan="6" className="text-center text-slate-500">
            Cargando invitaciones...</td></tr> : directory.invitations.length === 0
            ? <tr><td colSpan="6" className="text-center text-slate-500">
              {directory.error ? 'Reintentá la consulta para ver las invitaciones.'
                : 'No hay invitaciones para mostrar.'}</td></tr>
            : directory.invitations.map((invitation) => <InvitationRow key={invitation.id}
              invitation={invitation} pending={pending}
              onResend={(item) => runExistingAction(item, 'resend')}
              onRevoke={(item) => runExistingAction(item, 'revoke')} />)}
        </tbody>
      </Table>
      {directory.hasMore && !directory.loading ? <div className="mt-4 flex justify-center">
        <Button type="button" variant="outline" loading={directory.loadingMore}
          onClick={() => flowRef.current?.loadMore()}>Cargar más</Button>
      </div> : null}
    </Card>

    <Modal open={showCreate} title="Crear invitación" subtitle="El destinatario recibirá un enlace por email."
      onClose={() => { if (!pending) setShowCreate(false) }}>
      <form className="space-y-4" onSubmit={submitCreate}>
        <div><label htmlFor="invitation-email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="invitation-email" type="email" required className="form-input w-full"
            value={email} onChange={(event) => setEmail(event.target.value)} disabled={Boolean(pending)} /></div>
        <div><label htmlFor="invitation-role" className="mb-1 block text-sm font-medium">Rol</label>
          <select id="invitation-role" className="form-input w-full" value={role}
            onChange={(event) => setRole(event.target.value)} disabled={Boolean(pending)}>
            {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></div>
        {formError ? <Alert variant="error" title="No se pudo crear la invitación"
          description={formError} /> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={Boolean(pending)}
            onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button type="submit" loading={pending === 'create'} disabled={Boolean(pending)}>
            Registrar invitación</Button>
        </div>
      </form>
    </Modal>
  </div>
}

export default InvitationAdminPanel
