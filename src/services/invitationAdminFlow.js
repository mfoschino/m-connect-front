export const INVITATION_PAGE_SIZE = 50
export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked', 'expired']
export const INVITATION_ROLES = ['admin', 'operator', 'viewer']

const detailText = (error) => {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((entry) => entry?.msg).filter(Boolean).join(' ')
  return ''
}

export const invitationErrorMessage = (error, action = 'list') => {
  const status = error?.response?.status
  if (status === 401) return action === 'list'
    ? 'La sesión ya no está disponible. Iniciá sesión nuevamente.'
    : 'No se confirmó la operación por un problema de sesión. Revisá el listado y volvé a intentar cuando tengas una sesión válida.'
  if (status === 403) return 'Ya no tenés permiso para administrar invitaciones de esta organización.'
  if (status === 422 && action === 'list') {
    return 'El filtro o la paginación de invitaciones no son válidos.'
  }
  if ([400, 404, 409, 422, 429].includes(status)) {
    return detailText(error) || ({
      400: 'Esta invitación no se puede crear.',
      404: 'La invitación no existe o no pertenece a la organización activa.',
      409: 'La invitación cambió de estado o entra en conflicto con un acceso existente.',
      422: 'Revisá el email y el rol de la invitación.',
      429: 'El reenvío aún no está disponible. Intentá más tarde.',
    })[status]
  }
  return action === 'list'
    ? 'No se pudieron cargar las invitaciones. Intentá nuevamente.'
    : 'No se pudo confirmar el resultado. Revisá el listado antes de volver a intentar.'
}

export const validateInvitationDraft = ({ email, role }) => {
  const normalizedEmail = String(email || '').trim()
  if (!normalizedEmail) return { error: 'Ingresá un email.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { error: 'Ingresá un email válido.' }
  }
  if (!INVITATION_ROLES.includes(role)) return { error: 'Elegí un rol válido.' }
  return { value: { email: normalizedEmail, role } }
}

export const initialInvitationReadState = {
  invitations: [], statusFilter: '', nextSkip: 0, hasMore: true,
  loading: true, loadingMore: false, error: '',
}

export const createInvitationReadFlow = ({ getInvitations, onChange,
  limit = INVITATION_PAGE_SIZE }) => {
  let state = { ...initialInvitationReadState }
  let version = 0
  let busy = false
  let disposed = false

  const publish = (next) => {
    if (disposed) return
    state = next
    onChange({ ...state, invitations: [...state.invitations] })
  }

  const loadMore = async () => {
    if (disposed || busy || !state.hasMore) return
    busy = true
    const requestVersion = version
    const skip = state.nextSkip
    publish({ ...state, loading: skip === 0, loadingMore: skip > 0, error: '' })
    try {
      const response = await getInvitations({ status: state.statusFilter, skip, limit })
      if (disposed || requestVersion !== version) return
      if (!Array.isArray(response?.data)) throw new Error('Invalid invitation list response')
      const page = response.data
      const ids = new Set(state.invitations.map((invitation) => invitation.id))
      const unique = page.filter((invitation) => {
        if (!invitation?.id || ids.has(invitation.id)) return false
        ids.add(invitation.id)
        return true
      })
      publish({ ...state, invitations: [...state.invitations, ...unique],
        nextSkip: skip + page.length, hasMore: page.length === limit,
        loading: false, loadingMore: false })
    } catch (error) {
      if (disposed || requestVersion !== version) return
      const unauthorized = [401, 403].includes(error?.response?.status)
      publish({ ...state, invitations: unauthorized ? [] : state.invitations,
        nextSkip: unauthorized ? 0 : state.nextSkip,
        hasMore: !unauthorized, loading: false, loadingMore: false,
        error: invitationErrorMessage(error) })
    } finally {
      if (requestVersion === version) busy = false
    }
  }

  const refresh = (statusFilter = state.statusFilter, { force = false } = {}) => {
    if (disposed) return
    if (!force && busy && state.loading && state.nextSkip === 0
      && statusFilter === state.statusFilter) return
    version += 1
    busy = false
    publish({ ...initialInvitationReadState, statusFilter })
    return loadMore()
  }

  const setStatus = (statusFilter) => {
    if (disposed || statusFilter === state.statusFilter) return
    if (statusFilter && !INVITATION_STATUSES.includes(statusFilter)) return
    return refresh(statusFilter)
  }

  const dispose = () => { disposed = true; version += 1 }

  return { getState: () => state, loadMore, refresh, setStatus, dispose }
}

export const createInvitationActionGate = ({ isAllowed, isCurrent, onPendingChange }) => {
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
