export const MEMBER_PAGE_SIZE = 50

export const memberReadError = (error, kind = 'list') => {
  const status = error?.response?.status
  if (status === 401) return 'La sesión ya no está disponible. Iniciá sesión nuevamente.'
  if (status === 403) return 'Ya no tenés permiso para consultar los miembros de esta organización.'
  if (status === 404 && kind === 'detail') {
    return 'El miembro no existe o no pertenece a la organización activa.'
  }
  if (status === 422) return 'La solicitud de miembros contiene datos inválidos.'
  return kind === 'detail'
    ? 'No se pudo cargar el detalle. Intentá nuevamente.'
    : 'No se pudieron cargar los miembros. Intentá nuevamente.'
}

export const initialMemberReadState = {
  members: [],
  includeDisabled: false,
  nextSkip: 0,
  hasMore: true,
  loading: true,
  loadingMore: false,
  error: '',
  detail: { open: false, userId: null, member: null, loading: false, error: '' },
}

export const createMemberReadFlow = ({ listMembers, getMember, onChange, limit = MEMBER_PAGE_SIZE }) => {
  let state = { ...initialMemberReadState }
  let listVersion = 0
  let detailVersion = 0
  let listBusy = false
  let disposed = false

  const publish = (next) => {
    if (disposed) return
    state = next
    onChange({ ...state, members: [...state.members], detail: { ...state.detail } })
  }

  const loadMore = async () => {
    if (disposed || listBusy || !state.hasMore) return
    listBusy = true
    const version = listVersion
    const skip = state.nextSkip
    const firstPage = skip === 0
    publish({ ...state, loading: firstPage, loadingMore: !firstPage, error: '' })
    try {
      const response = await listMembers({ skip, limit, include_disabled: state.includeDisabled })
      if (disposed || version !== listVersion) return
      if (!Array.isArray(response?.data)) throw new Error('Invalid member list response')
      const page = response.data
      const ids = new Set(state.members.map((member) => member.id))
      const unique = page.filter((member) => {
        if (!member?.id || ids.has(member.id)) return false
        ids.add(member.id)
        return true
      })
      publish({ ...state, members: [...state.members, ...unique], nextSkip: skip + page.length,
        hasMore: page.length === limit, loading: false, loadingMore: false })
    } catch (error) {
      if (disposed || version !== listVersion) return
      const forbidden = [401, 403].includes(error?.response?.status)
      if (forbidden) detailVersion += 1
      publish({ ...state, members: forbidden ? [] : state.members,
        nextSkip: forbidden ? 0 : state.nextSkip, hasMore: !forbidden,
        loading: false, loadingMore: false, error: memberReadError(error),
        detail: forbidden ? { ...initialMemberReadState.detail } : state.detail })
    } finally {
      if (version === listVersion) listBusy = false
    }
  }

  const refresh = (includeDisabled = state.includeDisabled) => {
    if (disposed) return
    listVersion += 1
    detailVersion += 1
    listBusy = false
    publish({ ...initialMemberReadState, includeDisabled })
    return loadMore()
  }

  const setIncludeDisabled = (value) => {
    if (disposed || Boolean(value) === state.includeDisabled) return
    return refresh(Boolean(value))
  }

  const openDetail = async (userId) => {
    if (disposed || !userId) return
    if (state.detail.open && state.detail.userId === userId
      && (state.detail.loading || state.detail.member)) return
    detailVersion += 1
    const version = detailVersion
    publish({ ...state, detail: { open: true, userId, member: null, loading: true, error: '' } })
    try {
      const response = await getMember(userId)
      if (disposed || version !== detailVersion) return
      if (!response?.data || response.data.id !== userId) throw new Error('Invalid member detail response')
      publish({ ...state, detail: { open: true, userId, member: response.data, loading: false, error: '' } })
    } catch (error) {
      if (disposed || version !== detailVersion) return
      const forbidden = [401, 403].includes(error?.response?.status)
      if (forbidden) {
        listVersion += 1
        listBusy = false
      }
      publish({ ...state, members: forbidden ? [] : state.members,
        nextSkip: forbidden ? 0 : state.nextSkip, hasMore: forbidden ? false : state.hasMore,
        loading: forbidden ? false : state.loading,
        loadingMore: forbidden ? false : state.loadingMore,
        error: forbidden ? memberReadError(error) : state.error,
        detail: { open: true, userId, member: null, loading: false,
          error: memberReadError(error, 'detail') } })
    }
  }

  const closeDetail = () => {
    if (disposed) return
    detailVersion += 1
    publish({ ...state, detail: { ...initialMemberReadState.detail } })
  }

  const dispose = () => {
    disposed = true
    listVersion += 1
    detailVersion += 1
  }

  return { getState: () => state, loadMore, refresh, setIncludeDisabled, openDetail, closeDetail, dispose }
}
