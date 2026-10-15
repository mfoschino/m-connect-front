import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import userAdminService, { normalizeRole, USER_ROLES } from '../../services/api/userAdminService'
import { getIamPermissions } from '../../services/auth/iamPermissions'
import { confirmedMemberResponse, confirmedRoleResponse, createMemberActionGate,
  memberMutationError, reactivationMessage } from '../../services/memberAdminFlow'
import { createMemberReadFlow, initialMemberReadState } from '../../services/memberReadFlow'
import InvitationAdminPanel from './InvitationAdminPanel'

const roleOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
]

const roleLabel = (role) => roleOptions.find((option) => option.value === normalizeRole(role))?.label || 'Sin rol'

const formatDate = (value) => {
  if (!value) return 'Sin registro'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin registro'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export const MemberAccessBadge = ({ member }) => (
  <Badge variant={member.is_active ? 'online' : 'offline'}>
    {member.is_active ? 'Acceso activo' : 'Acceso inactivo'}
  </Badge>
)

export const MemberDetailContent = ({ member }) => (
  <dl className="grid gap-4 text-sm sm:grid-cols-2">
    <div><dt className="font-semibold text-slate-500">Nombre</dt><dd>{member.full_name || 'Sin nombre'}</dd></div>
    <div><dt className="font-semibold text-slate-500">Correo electrónico</dt><dd>{member.email}</dd></div>
    <div><dt className="font-semibold text-slate-500">Rol en esta organización</dt><dd>{roleLabel(member.role)}</dd></div>
    <div><dt className="font-semibold text-slate-500">Estado del acceso</dt><dd><MemberAccessBadge member={member} /></dd></div>
    {!member.is_active ? <div className="sm:col-span-2"><dt className="font-semibold text-slate-500">
      Alcance del estado</dt><dd>El acceso efectivo puede estar inactivo por la membresía o por la cuenta global.
      Esta respuesta no distingue la causa.</dd></div> : null}
    <div><dt className="font-semibold text-slate-500">Correo verificado</dt>
      <dd>{member.is_verified ? 'Sí' : 'No'}</dd></div>
    <div><dt className="font-semibold text-slate-500">Último inicio de sesión (global)</dt>
      <dd>{formatDate(member.last_login)}</dd></div>
    <div><dt className="font-semibold text-slate-500">Alta de la cuenta</dt>
      <dd>{formatDate(member.created_at)}</dd></div>
  </dl>
)

export const MemberRow = ({ record, pendingKey = '', isSelf = false,
  onRoleChange, onDeactivate, onReactivate, onDetail }) => {
  const currentRole = normalizeRole(record.role) || 'viewer'
  const [selection, setSelection] = useState({ saved: currentRole, draft: currentRole })
  const draftRole = selection.saved === currentRole ? selection.draft : currentRole
  const pending = Boolean(pendingKey)
  const roleChanged = draftRole !== currentRole
  return (
    <tr>
      <td className="font-medium text-slate-900">{record.full_name || 'Sin nombre'}</td>
      <td>{record.email}</td>
      <td>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Actual: {roleLabel(record.role)}</span>
          <label className="sr-only" htmlFor={`role-${record.id}`}>Nuevo rol de {record.email}</label>
          <select id={`role-${record.id}`} className="form-input min-w-36 py-2"
            value={draftRole} onChange={(event) => setSelection({
              saved: currentRole, draft: event.target.value })}
            disabled={pending || isSelf} title={isSelf ? 'No podés cambiar tu propio rol' : undefined}>
            {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <Button type="button" variant="ghost" onClick={() => onRoleChange(record, draftRole)}
            disabled={pending || isSelf || !roleChanged}
            loading={pendingKey === `role:${record.id}`}>Guardar rol</Button>
          {roleChanged ? <span className="text-xs text-amber-700">Cambio sin guardar</span> : null}
        </div>
      </td>
      <td><MemberAccessBadge member={record} /></td>
      <td>{formatDate(record.last_login)}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => onDetail(record.id)}>Ver detalle</Button>
          {isSelf ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />Tu acceso</span> : (
            record.is_active ? <Button type="button" variant="ghost"
              className="rounded-full px-3 py-1 text-sm text-rose-600"
              onClick={() => onDeactivate(record)} disabled={pending}
              loading={pendingKey === `disable:${record.id}`}>Deshabilitar acceso</Button>
              : <div className="space-y-1">
                <Button type="button" variant="ghost" onClick={() => onReactivate(record)}
                  disabled={pending} loading={pendingKey === `reactivate:${record.id}`}>
                  Habilitar membresía</Button>
                <p className="max-w-52 text-xs text-slate-500">
                  El acceso también puede estar inactivo por la cuenta global.</p>
              </div>
          )}
        </div>
      </td>
    </tr>
  )
}

const UserAdminPage = () => {
  const auth = useAuth()
  const { user, contextId } = auth
  const authRef = useRef(auth)
  useLayoutEffect(() => { authRef.current = auth }, [auth])
  const flowRef = useRef(null)
  const gateRef = useRef(null)
  const [directory, setDirectory] = useState(initialMemberReadState)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [pendingKey, setPendingKey] = useState('')
  const [activeTab, setActiveTab] = useState('members')
  const canAdmin = getIamPermissions(auth).canViewUserAdmin

  useEffect(() => {
    if (!canAdmin || activeTab !== 'members') return undefined
    const flow = createMemberReadFlow({
      listMembers: userAdminService.listUsers,
      getMember: userAdminService.getUser,
      onChange: setDirectory,
    })
    flowRef.current = flow
    flow.refresh()
    return () => {
      flow.dispose()
      if (flowRef.current === flow) flowRef.current = null
    }
  }, [contextId, user?.tenant_id, canAdmin, activeTab])

  useEffect(() => {
    if (!canAdmin || activeTab !== 'members') return undefined
    const tenantId = user.tenant_id
    const isCurrent = () => authRef.current.contextId === contextId
      && authRef.current.user?.tenant_id === tenantId
    const isAllowed = () => getIamPermissions(authRef.current).canViewUserAdmin
    const gate = createMemberActionGate({ isCurrent, isAllowed,
      onPendingChange: setPendingKey })
    gateRef.current = gate
    return () => {
      gate.dispose()
      if (gateRef.current === gate) gateRef.current = null
    }
  }, [contextId, user?.tenant_id, canAdmin, activeTab])

  const isSelf = (record) => Boolean(record?.id && record.id === user?.id)
  const canActFor = (record) => Boolean(record?.id && record.tenant_id
    && record.tenant_id === authRef.current.user?.tenant_id
    && getIamPermissions(authRef.current).canViewUserAdmin)

  const showMutationFailure = (result, action) => {
    if (!result || result.kind === 'blocked' || result.kind === 'stale') return
    setActionError(result.kind === 'error'
      ? memberMutationError(result.error, action)
      : `No se pudo confirmar ${action}. Refrescá los miembros antes de volver a intentar.`)
  }

  const handleRoleChange = async (record, nextRoleValue) => {
    const nextRole = normalizeRole(nextRoleValue)
    if (!record?.id || !USER_ROLES.includes(nextRole) || nextRole === normalizeRole(record.role)) return
    if (!canActFor(record)) {
      setActionError('Ya no tenés permiso para administrar este miembro en la organización activa.')
      return
    }
    if (isSelf(record)) {
      setActionError('No podés cambiar tu propio rol desde esta pantalla.')
      return
    }
    if (gateRef.current?.getPending()) return
    if (!window.confirm(`¿Cambiar el rol de ${record.email} a ${roleLabel(nextRole)}?`)) return
    setActionError('')
    setSuccessMessage('')
    const result = await gateRef.current?.run(`role:${record.id}`,
      () => userAdminService.updateUser(record.id, { role: nextRole }), 200)
    if (result?.kind === 'success') {
      if (!confirmedRoleResponse(result.response, record, nextRole)) {
        setActionError('No se pudo confirmar el nuevo rol. Refrescá los miembros antes de volver a intentar.')
        return
      }
      setSuccessMessage('Rol en la organización actualizado correctamente.')
      await flowRef.current?.refreshAfterMutation()
    } else {
      showMutationFailure(result, 'el cambio de rol')
    }
  }

  const handleDeactivate = async (record) => {
    if (!record?.id) return
    if (!canActFor(record)) {
      setActionError('Ya no tenés permiso para administrar este miembro en la organización activa.')
      return
    }
    if (isSelf(record)) {
      setActionError('No podés deshabilitar tu propio acceso.')
      return
    }
    if (!record.is_active || gateRef.current?.getPending()) return
    if (!window.confirm(`¿Deshabilitar el acceso de ${record.email} a esta organización? La cuenta global y sus otras organizaciones no se eliminan.`)) return
    setActionError('')
    setSuccessMessage('')
    const result = await gateRef.current?.run(`disable:${record.id}`,
      () => userAdminService.deactivateUser(record.id), 204)
    if (result?.kind === 'success') {
      setSuccessMessage('Acceso a la organización deshabilitado correctamente.')
      await flowRef.current?.refreshAfterMutation()
    } else {
      showMutationFailure(result, 'la deshabilitación de la membresía')
    }
  }

  const handleReactivate = async (record) => {
    if (!canActFor(record)) {
      setActionError('Ya no tenés permiso para administrar este miembro en la organización activa.')
      return
    }
    if (record.is_active || gateRef.current?.getPending()) return
    setActionError('')
    setSuccessMessage('')
    const result = await gateRef.current?.run(`reactivate:${record.id}`,
      () => userAdminService.reactivateUser(record.id), 200)
    if (result?.kind === 'success') {
      if (!confirmedMemberResponse(result.response, record)) {
        setActionError('No se pudo confirmar el estado del acceso. Refrescá los miembros antes de volver a intentar.')
        return
      }
      setSuccessMessage(reactivationMessage(result.response.data))
      await flowRef.current?.refreshAfterMutation()
    } else {
      showMutationFailure(result, 'la habilitación de la membresía')
    }
  }

  if (!canAdmin) {
    return <Alert variant="warning" title="Acceso administrativo requerido"
      description="Esta pantalla requiere un tenant activo y rol de administrador en esa organización." />
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Administración</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Miembros e invitaciones de la organización</h2>
            <p className="section-subtitle">
              Consultá los accesos y administrá las invitaciones de la organización activa.
            </p>
          </div>
          {activeTab === 'members' ? <Button type="button" variant="outline"
            onClick={() => flowRef.current?.refresh()}
            loading={directory.loading && directory.members.length > 0}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refrescar
          </Button> : null}
        </div>
      </div>

      <div role="group" aria-label="Secciones de administración de la organización"
        className="flex gap-2 border-b border-slate-200">
        <button type="button" aria-pressed={activeTab === 'members'}
          onClick={() => {
            if (activeTab !== 'members') { setPendingKey(''); setActiveTab('members') }
          }}
          className={`px-4 py-2 text-sm font-semibold ${activeTab === 'members'
            ? 'border-b-2 border-sky-600 text-sky-700' : 'text-slate-600'}`}>
          Miembros
        </button>
        <button type="button" aria-pressed={activeTab === 'invitations'}
          onClick={() => {
            gateRef.current?.dispose()
            setPendingKey('')
            setActiveTab('invitations')
          }}
          className={`px-4 py-2 text-sm font-semibold ${activeTab === 'invitations'
            ? 'border-b-2 border-sky-600 text-sky-700' : 'text-slate-600'}`}>
          Invitaciones
        </button>
      </div>

      {activeTab === 'members' ? <>

      {successMessage ? <Alert variant="success" title="Operación completada"
        description={successMessage} onClose={() => setSuccessMessage('')} /> : null}
      {actionError ? <Alert variant="error" title="No se pudo completar la acción"
        description={actionError} onClose={() => setActionError('')} /> : null}

      <Card title="Miembros" description="El servidor consulta sólo la organización activa de la sesión.">
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={directory.includeDisabled}
            onChange={(event) => flowRef.current?.setIncludeDisabled(event.target.checked)} />
          Incluir miembros inactivos
        </label>
        {directory.error ? <Alert variant="error" title="No se pudo cargar el listado"
          description={directory.error} /> : null}
        <Table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo electrónico</th>
              <th>Rol en esta organización</th>
              <th>Estado</th>
              <th>Último inicio de sesión (global)</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {directory.loading ? (
              <tr><td colSpan="6" className="text-center text-sm text-slate-500">Cargando miembros...</td></tr>
            ) : directory.members.length === 0 ? (
              <tr><td colSpan="6" className="text-center text-sm text-slate-500">
                {directory.error ? 'Reintentá la consulta para ver los miembros.' : 'No hay miembros para mostrar.'}
              </td></tr>
            ) : directory.members.map((record) => <MemberRow
              key={`${record.id}:${record.role}:${record.is_active}`} record={record}
              pendingKey={pendingKey} isSelf={isSelf(record)}
              onRoleChange={handleRoleChange} onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
              onDetail={(id) => flowRef.current?.openDetail(id)} />)}
          </tbody>
        </Table>
        {directory.hasMore && !directory.loading ? (
          <div className="mt-4 flex justify-center">
            <Button type="button" variant="outline" onClick={() => flowRef.current?.loadMore()}
              loading={directory.loadingMore}>Cargar más</Button>
          </div>
        ) : null}
      </Card>

      <Modal open={directory.detail.open} title="Detalle del miembro"
        subtitle="Datos del miembro en la organización activa" onClose={() => flowRef.current?.closeDetail()}>
        {directory.detail.loading ? <p>Cargando detalle...</p> : null}
        {directory.detail.error ? <Alert variant="error" title="No se pudo cargar el detalle"
          description={directory.detail.error} /> : null}
        {directory.detail.error ? <Button type="button" variant="outline" className="mt-4"
          onClick={() => flowRef.current?.openDetail(directory.detail.userId)}>Reintentar</Button> : null}
        {directory.detail.member ? <MemberDetailContent member={directory.detail.member} /> : null}
      </Modal>
      </> : <InvitationAdminPanel />}
    </div>
  )
}

export default UserAdminPage
