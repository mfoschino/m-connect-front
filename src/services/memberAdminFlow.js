export const memberMutationError = (error, action) => {
  const status = error?.response?.status
  if (status === 401) {
    return 'No se confirmó la operación por un problema de sesión. Revisá los miembros antes de volver a intentar.'
  }
  if (status === 403) {
    const detail = error?.response?.data?.detail
    if (typeof detail === 'string' && /propio rol/i.test(detail)) {
      return 'No podés cambiar tu propio rol.'
    }
    if (typeof detail === 'string' && /desactivar tu propia cuenta/i.test(detail)) {
      return 'No podés deshabilitar tu propio acceso a esta organización.'
    }
    return 'Ya no tenés permiso de administrador en esta organización.'
  }
  if (status === 404) return 'El miembro no existe o no pertenece a la organización activa.'
  if (status === 409) {
    return 'No se puede realizar esta operación porque la organización debe conservar al menos un administrador activo.'
  }
  if (status === 422) return 'Los datos del miembro o el rol seleccionado no son válidos.'
  return `No se pudo confirmar ${action}. Refrescá los miembros antes de volver a intentar.`
}

export const confirmedMemberResponse = (response, member) =>
  response?.data?.id === member?.id && response.data.tenant_id === member.tenant_id
  && typeof response.data.is_active === 'boolean'

export const confirmedRoleResponse = (response, member, role) =>
  confirmedMemberResponse(response, member) && response.data.role === role

export const reactivationMessage = (member) => member.is_active
  ? 'La membresía quedó habilitada y el acceso efectivo está activo.'
  : 'La membresía quedó habilitada, pero el acceso efectivo sigue inactivo. La cuenta global puede estar inactiva.'

export const createMemberActionGate = ({ isAllowed, isCurrent, onPendingChange }) => {
  let pending = ''
  let disposed = false

  const run = async (key, operation, expectedStatus) => {
    if (disposed || pending || !isCurrent() || !isAllowed()) return { kind: 'blocked' }
    pending = key
    onPendingChange(key)
    try {
      const response = await operation()
      if (disposed || !isCurrent() || !isAllowed()) return { kind: 'stale' }
      if (response?.status !== expectedStatus) return { kind: 'uncertain' }
      return { kind: 'success', response }
    } catch (error) {
      if (disposed || !isCurrent() || !isAllowed()) return { kind: 'stale' }
      return { kind: 'error', error }
    } finally {
      pending = ''
      if (!disposed && isCurrent()) onPendingChange('')
    }
  }

  const dispose = () => { disposed = true }
  return { run, dispose, getPending: () => pending }
}
