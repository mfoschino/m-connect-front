import { useEffect, useRef, useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import userAdminService, { normalizeRole, USER_ROLES } from '../../services/api/userAdminService'
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

const resolveErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg).filter(Boolean).join(' ') || fallback
  return typeof detail === 'string' ? detail : fallback
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
    <div><dt className="font-semibold text-slate-500">Correo verificado</dt>
      <dd>{member.is_verified ? 'Sí' : 'No'}</dd></div>
    <div><dt className="font-semibold text-slate-500">Último inicio de sesión (global)</dt>
      <dd>{formatDate(member.last_login)}</dd></div>
    <div><dt className="font-semibold text-slate-500">Alta de la cuenta</dt>
      <dd>{formatDate(member.created_at)}</dd></div>
  </dl>
)

export const MemberRow = ({ record, actionUserId = '', isSelf = false,
  onRoleChange, onDeactivate, onDetail }) => {
  const disabled = actionUserId === record.id || record.is_active === false
  return (
    <tr>
      <td className="font-medium text-slate-900">{record.full_name || 'Sin nombre'}</td>
      <td>{record.email}</td>
      <td>
        <label className="sr-only" htmlFor={`role-${record.id}`}>Rol de {record.email}</label>
        <select id={`role-${record.id}`} className="form-input min-w-36 py-2"
          value={normalizeRole(record.role) || 'viewer'}
          onChange={(event) => onRoleChange(record, event.target.value)}
          disabled={disabled || isSelf}>
          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </td>
      <td><MemberAccessBadge member={record} /></td>
      <td>{formatDate(record.last_login)}</td>
      <td>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => onDetail(record.id)}>Ver detalle</Button>
          {isSelf ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />Tu acceso</span> : (
            <Button type="button" variant="ghost" className="rounded-full px-3 py-1 text-sm text-rose-600"
              onClick={() => onDeactivate(record)} disabled={disabled}
              loading={actionUserId === record.id}>Deshabilitar acceso</Button>
          )}
        </div>
      </td>
    </tr>
  )
}

const UserAdminPage = () => {
  const { user, contextId } = useAuth()
  const flowRef = useRef(null)
  const [directory, setDirectory] = useState(initialMemberReadState)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [actionUserId, setActionUserId] = useState('')
  const [activeTab, setActiveTab] = useState('members')
  const currentUserRole = normalizeRole(user?.role)

  useEffect(() => {
    if (!user?.tenant_id || currentUserRole !== 'admin' || activeTab !== 'members') return undefined
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
  }, [contextId, user?.tenant_id, currentUserRole, activeTab])

  const isSelf = (record) => Boolean(record && (
    (user?.id && record.id === user.id)
    || (user?.email && record.email?.toLowerCase() === user.email.toLowerCase())
  ))

  const handleRoleChange = async (record, nextRoleValue) => {
    const nextRole = normalizeRole(nextRoleValue)
    if (!record?.id || !USER_ROLES.includes(nextRole) || nextRole === normalizeRole(record.role)) return
    if (isSelf(record)) {
      setActionError('No podés cambiar tu propio rol desde esta pantalla.')
      return
    }
    if (!window.confirm(`¿Cambiar el rol de ${record.email} a ${roleLabel(nextRole)}?`)) return
    setActionUserId(record.id)
    setActionError('')
    setSuccessMessage('')
    try {
      await userAdminService.updateUser(record.id, { role: nextRole })
      setSuccessMessage('Rol en la organización actualizado correctamente.')
      await flowRef.current?.refresh()
    } catch (error) {
      console.error('Failed to update member role', { status: error?.response?.status ?? null })
      setActionError(resolveErrorMessage(error, 'No se pudo actualizar el rol.'))
    } finally {
      setActionUserId('')
    }
  }

  const handleDeactivate = async (record) => {
    if (!record?.id) return
    if (isSelf(record)) {
      setActionError('No podés deshabilitar tu propio acceso.')
      return
    }
    if (!window.confirm(`¿Deshabilitar el acceso de ${record.email} a esta organización?`)) return
    setActionUserId(record.id)
    setActionError('')
    setSuccessMessage('')
    try {
      await userAdminService.deactivateUser(record.id)
      setSuccessMessage('Acceso a la organización deshabilitado correctamente.')
      await flowRef.current?.refresh()
    } catch (error) {
      console.error('Failed to deactivate member access', { status: error?.response?.status ?? null })
      setActionError(resolveErrorMessage(error, 'No se pudo deshabilitar el acceso.'))
    } finally {
      setActionUserId('')
    }
  }

  if (!user?.tenant_id || currentUserRole !== 'admin') {
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
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 text-sm font-semibold ${activeTab === 'members'
            ? 'border-b-2 border-sky-600 text-sky-700' : 'text-slate-600'}`}>
          Miembros
        </button>
        <button type="button" aria-pressed={activeTab === 'invitations'}
          onClick={() => setActiveTab('invitations')}
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
            ) : directory.members.map((record) => <MemberRow key={record.id} record={record}
              actionUserId={actionUserId} isSelf={isSelf(record)}
              onRoleChange={handleRoleChange} onDeactivate={handleDeactivate}
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
