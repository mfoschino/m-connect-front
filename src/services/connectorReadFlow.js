const emptyList = () => ({ data: [], loading: true, error: '' })
const emptyDetail = () => ({ open: false, id: null, data: null, loading: false, error: '' })
export const initialConnectorReadState = () => ({
  definitions: emptyList(), installations: emptyList(), detail: emptyDetail(),
})

export const connectorReadError = (error, resource) => {
  const status = error?.response?.status
  if (status === 401) return 'La sesión ya no está disponible. Iniciá sesión nuevamente.'
  if (status === 403) return 'No tenés permiso para consultar conectores en esta organización.'
  if (status === 404) return resource === 'detail'
    ? 'La instalación no existe o no está disponible en esta organización.'
    : 'La consulta de conectores no está disponible en el servidor.'
  if (status === 422) return 'El servidor no pudo validar la consulta de conectores.'
  return resource === 'detail'
    ? 'No se pudo cargar el detalle de la instalación. Intentá nuevamente.'
    : 'No se pudo cargar el listado. Intentá nuevamente.'
}

// Un flujo por contexto IAM. Los contadores protegen incluso si el transporte ignora abort().
export const createConnectorReadFlow = ({ api, tenantId, onChange }) => {
  let state = initialConnectorReadState()
  let disposed = false
  const requests = { definitions: null, installations: null, detail: null }
  const generations = { definitions: 0, installations: 0, detail: 0 }
  const publish = (next) => {
    if (disposed) return
    state = next
    onChange(state)
  }
  const invalidate = (resource) => {
    generations[resource] += 1
    requests[resource]?.abort()
    requests[resource] = null
  }
  const begin = (resource) => {
    invalidate(resource)
    const controller = new AbortController()
    requests[resource] = controller
    const generation = generations[resource]
    return { signal: controller.signal,
      isCurrent: () => !disposed && generation === generations[resource] }
  }
  const clearForbidden = (error) => {
    for (const resource of Object.keys(requests)) invalidate(resource)
    const message = connectorReadError(error)
    publish({ definitions: { data: [], loading: false, error: message },
      installations: { data: [], loading: false, error: message }, detail: emptyDetail() })
  }
  const fail = (error, resource, isCurrent) => {
    if (!isCurrent()) return
    if ([401, 403].includes(error?.response?.status)) {
      clearForbidden(error)
      return
    }
    publish({ ...state, [resource]: { ...state[resource], loading: false,
      error: connectorReadError(error, resource) } })
  }

  const closeDetail = () => {
    if (disposed) return
    invalidate('detail')
    publish({ ...state, detail: emptyDetail() })
  }
  const loadList = async (resource) => {
    if (disposed || !tenantId) return
    if (resource === 'installations') closeDetail()
    const { signal, isCurrent } = begin(resource)
    publish({ ...state, [resource]: emptyList() })
    try {
      const response = resource === 'definitions'
        ? await api.listDefinitions({ include_inactive: true }, { signal })
        : await api.listInstallations({}, { signal })
      if (!isCurrent()) return
      const data = response.data
      if (!Array.isArray(data) || (resource === 'installations'
        && data.some((item) => item.tenant_id !== tenantId))
        || (resource === 'definitions'
          && data.some((item) => item.visibility !== 'public' && item.owner_tenant_id !== tenantId))) {
        throw new Error('Respuesta de conectores incompatible con el contexto activo.')
      }
      publish({ ...state, [resource]: { data, loading: false, error: '' } })
    } catch (error) {
      fail(error, resource, isCurrent)
    }
  }
  const openDetail = async (id) => {
    if (disposed || !tenantId || !id) return
    const { signal, isCurrent } = begin('detail')
    publish({ ...state, detail: { open: true, id, data: null, loading: true, error: '' } })
    try {
      const response = await api.getInstallation(id, { signal })
      if (!isCurrent()) return
      if (response.data?.id !== id || response.data?.tenant_id !== tenantId) {
        throw new Error('El detalle no corresponde a la instalación solicitada.')
      }
      publish({ ...state, detail: { open: true, id, data: response.data, loading: false, error: '' } })
    } catch (error) {
      fail(error, 'detail', isCurrent)
    }
  }
  const dispose = () => {
    disposed = true
    for (const resource of Object.keys(requests)) invalidate(resource)
    state = initialConnectorReadState()
  }
  return { getState: () => state, loadDefinitions: () => loadList('definitions'),
    loadInstallations: () => loadList('installations'), openDetail, closeDetail, dispose }
}
