import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShieldAlert, UserPlus } from 'lucide-react'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Table from '../../components/ui/Table'
import { useAuth } from '../../context/AuthContext'
import userAdminService, { normalizeRole, USER_ROLES } from '../../services/api/userAdminService'

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Viewer' },
]

const statusLabels = {
  active: 'Activa',
  invited: 'Invitada',
  pending: 'Pendiente',
  disabled: 'Desactivada',
}

const statusVariants = {
  active: 'online',
  invited: 'pending',
  pending: 'retrying',
  disabled: 'offline',
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const roleLabel = (role) => roleOptions.find((option) => option.value === normalizeRole(role))?.label || 'Sin rol'

const normalizeStatus = (record) => {
  if (record?.is_active === false) return 'disabled'
  if (record?.status) return String(record.status).toLowerCase()
  if (record?.is_verified === false) return 'pending'
  return 'active'
}

const formatLastAccess = (record) => {
  const value = record?.lastLoginAt
    || record?.lastAccessAt
    || record?.lastSeenAt
    || record?.last_sign_in_at
    || record?.last_login_at
    || record?.last_login

  if (!value) return 'Nunca'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin registro'

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const buildTemporaryPassword = () => {
  if (window.crypto?.randomUUID) {
    return `${window.crypto.randomUUID()}Aa1!`
  }

  return `${Date.now()}Aa1!${Math.random().toString(36).slice(2)}`
}

const resolveErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail

  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg).filter(Boolean).join(' ')
  }

  return detail || error?.message || fallback
}

const UserAdminPage = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer' })
  const [inviteErrors, setInviteErrors] = useState({})
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [actionUserId, setActionUserId] = useState('')

  const currentUserRole = normalizeRole(user?.role)

  const activeAdmins = useMemo(
    () => users.filter((record) => normalizeRole(record.role) === 'admin' && record.is_active !== false),
    [users],
  )

  const loadUsers = useCallback(async ({ showRefreshing = false } = {}) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const response = await userAdminService.listUsers()
      setUsers(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      console.error('Failed to load tenant users', err)
      setError(resolveErrorMessage(err, 'No se pudieron cargar los usuarios del tenant.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadUsers()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadUsers])

  const isSelf = (record) => {
    if (!record) return false
    return Boolean(
      (user?.id && record.id === user.id)
      || (user?.email && record.email?.toLowerCase() === user.email.toLowerCase()),
    )
  }

  const wouldLeaveTenantWithoutAdmin = (record) =>
    normalizeRole(record?.role) === 'admin' && record?.is_active !== false && activeAdmins.length <= 1

  const validateInvite = () => {
    const nextErrors = {}
    const email = inviteForm.email.trim().toLowerCase()
    const role = normalizeRole(inviteForm.role)

    if (!email) {
      nextErrors.email = 'El email es requerido.'
    } else if (!emailPattern.test(email)) {
      nextErrors.email = 'Ingrese un email valido.'
    }

    if (!role) {
      nextErrors.role = 'Seleccione un rol.'
    } else if (!USER_ROLES.includes(role)) {
      nextErrors.role = 'Seleccione un rol valido.'
    }

    setInviteErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const closeInviteModal = ({ force = false } = {}) => {
    if (inviteLoading && !force) return
    setInviteOpen(false)
    setInviteForm({ email: '', role: 'viewer' })
    setInviteErrors({})
    setInviteError('')
  }

  const handleInviteSubmit = async (event) => {
    event.preventDefault()
    setInviteError('')
    setSuccessMessage('')

    if (!validateInvite()) return

    setInviteLoading(true)

    try {
      await userAdminService.createUser({
        email: inviteForm.email.trim().toLowerCase(),
        password: buildTemporaryPassword(),
        full_name: null,
        role: normalizeRole(inviteForm.role),
      })
      setSuccessMessage('Usuario provisionado correctamente en el tenant.')
      closeInviteModal({ force: true })
      await loadUsers({ showRefreshing: true })
    } catch (err) {
      console.error('Failed to invite user', err)
      setInviteError(resolveErrorMessage(err, 'No se pudo invitar/provisionar el usuario.'))
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRoleChange = async (record, nextRoleValue) => {
    const nextRole = normalizeRole(nextRoleValue)
    if (!record?.id || !USER_ROLES.includes(nextRole) || nextRole === normalizeRole(record.role)) return

    if (isSelf(record)) {
      setError('No puedes cambiar tu propio rol desde esta pantalla.')
      return
    }

    if (wouldLeaveTenantWithoutAdmin(record) && nextRole !== 'admin') {
      setError('Debe quedar al menos un admin activo en el tenant.')
      return
    }

    if (!window.confirm(`Cambiar rol de ${record.email} a ${roleLabel(nextRole)}?`)) {
      return
    }

    setActionUserId(record.id)
    setError('')
    setSuccessMessage('')

    try {
      await userAdminService.updateUser(record.id, { role: nextRole })
      setSuccessMessage('Rol actualizado correctamente.')
      await loadUsers({ showRefreshing: true })
    } catch (err) {
      console.error('Failed to update role', err)
      setError(resolveErrorMessage(err, 'No se pudo actualizar el rol.'))
    } finally {
      setActionUserId('')
    }
  }

  const handleDeactivate = async (record) => {
    if (!record?.id) return

    if (isSelf(record)) {
      setError('No puedes desactivar tu propia cuenta.')
      return
    }

    if (wouldLeaveTenantWithoutAdmin(record)) {
      setError('No puedes desactivar el unico admin activo del tenant.')
      return
    }

    if (!window.confirm(`Desactivar la cuenta de ${record.email}? El usuario perdera acceso al tenant.`)) {
      return
    }

    setActionUserId(record.id)
    setError('')
    setSuccessMessage('')

    try {
      await userAdminService.deactivateUser(record.id)
      setSuccessMessage('Cuenta desactivada correctamente.')
      await loadUsers({ showRefreshing: true })
    } catch (err) {
      console.error('Failed to deactivate user', err)
      setError(resolveErrorMessage(err, 'No se pudo desactivar la cuenta.'))
    } finally {
      setActionUserId('')
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Administracion</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Usuarios del tenant</h2>
            <p className="section-subtitle">
              Gestiona acceso, roles y estado de las cuentas dentro de tu organizacion.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => loadUsers({ showRefreshing: true })} loading={refreshing}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Refrescar
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              Invitar usuario
            </Button>
          </div>
        </div>
      </div>

      {currentUserRole !== 'admin' ? (
        <Alert
          variant="warning"
          title="Acceso administrativo requerido"
          description="Esta pantalla solo permite operar a usuarios con rol admin."
        />
      ) : null}

      <Alert
        variant="info"
        title="Contrato de invitaciones"
        description="La API documentada no expone un endpoint de invitacion por email; esta pantalla usa POST /users/ para provisionar usuarios en el tenant actual."
      />

      {successMessage ? (
        <Alert
          variant="success"
          title="Operacion completada"
          description={successMessage}
          onClose={() => setSuccessMessage('')}
        />
      ) : null}

      {error ? (
        <Alert
          variant="error"
          title="No se pudo completar la accion"
          description={error}
          onClose={() => setError('')}
        />
      ) : null}

      <Card
        title="Cuentas"
        description="El backend filtra por tenant del admin autenticado; no se envia tenant_id desde el frontend."
      >
        <Table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Ultimo acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center text-sm text-slate-500">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center text-sm text-slate-500">
                  Todavia no hay usuarios para mostrar.
                </td>
              </tr>
            ) : (
              users.map((record) => {
                const status = normalizeStatus(record)
                const disabled = actionUserId === record.id || record.is_active === false
                const protectedSelf = isSelf(record)
                const protectedLastAdmin = wouldLeaveTenantWithoutAdmin(record)

                return (
                  <tr key={record.id || record.email}>
                    <td className="font-medium text-slate-900">{record.full_name || record.name || 'Sin nombre'}</td>
                    <td>{record.email}</td>
                    <td>
                      <label className="sr-only" htmlFor={`role-${record.id || record.email}`}>
                        Rol de {record.email}
                      </label>
                      <select
                        id={`role-${record.id || record.email}`}
                        className="form-input min-w-36 py-2"
                        value={normalizeRole(record.role) || 'viewer'}
                        onChange={(event) => handleRoleChange(record, event.target.value)}
                        disabled={disabled || protectedSelf || protectedLastAdmin}
                      >
                        {roleOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <Badge variant={statusVariants[status] || 'pending'}>
                        {statusLabels[status] || status}
                      </Badge>
                    </td>
                    <td>{formatLastAccess(record)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {protectedSelf ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                            Tu cuenta
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            className="rounded-full px-3 py-1 text-sm text-rose-600"
                            onClick={() => handleDeactivate(record)}
                            disabled={disabled || protectedLastAdmin}
                            loading={actionUserId === record.id}
                          >
                            Desactivar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </Card>

      <Modal open={inviteOpen} title="Invitar usuario" subtitle="Alta de cuenta dentro del tenant actual" onClose={closeInviteModal} footer={null}>
        <form className="space-y-5" onSubmit={handleInviteSubmit} noValidate>
          {inviteError ? (
            <Alert variant="error" title="No se pudo enviar la invitacion" description={inviteError} />
          ) : null}
          <Input
            id="invite-email"
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
            error={inviteErrors.email}
            placeholder="persona@empresa.com"
            autoComplete="email"
            disabled={inviteLoading}
          />
          <div className="space-y-2">
            <label htmlFor="invite-role" className="block text-sm font-semibold text-slate-900">
              Rol inicial
            </label>
            <select
              id="invite-role"
              className={`form-input ${inviteErrors.role ? 'input-error' : ''}`}
              value={inviteForm.role}
              onChange={(event) => setInviteForm((current) => ({ ...current, role: event.target.value }))}
              disabled={inviteLoading}
              required
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {inviteErrors.role ? <p className="text-sm font-medium text-red-600">{inviteErrors.role}</p> : null}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            El contrato actual crea/provisiona usuarios con password temporal; no confirma envio de email de invitacion.
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={closeInviteModal} disabled={inviteLoading}>
              Cancelar
            </Button>
            <Button type="submit" loading={inviteLoading}>
              Invitar usuario
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default UserAdminPage
