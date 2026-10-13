import { normalizeApiScope } from './iamStorage.js'
import { IamSessionError } from './iamSession.js'

const PUBLIC_ROUTES = new Set([
  '/auth/login', '/auth/login/otp', '/auth/login/otp/resend', '/auth/refresh',
  '/auth/forgot-password', '/auth/reset-password',
  '/auth/invitations/inspect', '/auth/invitations/accept',
  '/auth/register', '/auth/verify-email', '/auth/resend-verification',
  '/health',
])
const BYPASS_ROUTES = new Set([...PUBLIC_ROUTES, '/auth/logout'])

export const installIamAxios = (client, { manager, apiBaseUrl, onForbidden,
  isBusinessReady }) => {
  if (!client?.interceptors?.request || !client?.interceptors?.response || !manager) {
    throw new TypeError('Se requiere Axios aislado y un gestor IAM.')
  }
  const scope = normalizeApiScope(apiBaseUrl)
  const base = new URL(scope)
  const basePath = base.pathname.replace(/\/$/, '')
  const requestContext = new WeakMap()

  const routeFor = (config) => {
    let url
    try {
      url = new URL(client.getUri(config))
    } catch {
      return null
    }
    if (url.origin !== base.origin) return null
    if (basePath && url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`)) {
      return null
    }
    return url.pathname.slice(basePath.length) || '/'
  }

  const requestId = client.interceptors.request.use(async (config) => {
    const route = routeFor(config)
    if (config._iamRetryContext && (!route || BYPASS_ROUTES.has(route))) {
      throw new IamSessionError('unauthorized_api_scope')
    }
    if (PUBLIC_ROUTES.has(route)) {
      // Los endpoints públicos tampoco deben heredar Bearer de defaults de Axios.
      if (typeof config.headers?.delete === 'function') config.headers.delete('Authorization')
      else if (config.headers) {
        delete config.headers.Authorization
        delete config.headers.authorization
      }
      return config
    }
    if (!route || route === '/auth/logout') return config
    if (config._iamRetryContext && !manager.isSameContext(config._iamRetryContext)) {
      throw new IamSessionError('context_changed')
    }
    const context = manager.getContextSnapshot()
    if (manager.getState().status === 'switching') {
      throw new IamSessionError('switch_in_progress')
    }
    if (isBusinessReady && !isBusinessReady(context)) {
      throw new IamSessionError('authorization_pending')
    }
    let accessToken = manager.getAccessToken()
    if (!accessToken) {
      const status = manager.getState().status
      if (!context.contextId || !['pending_restore', 'tokens_available'].includes(status)) {
        throw new IamSessionError('no_refresh_credential')
      }
      await manager.refresh()
      if (!manager.isSameContext(context)) throw new IamSessionError('context_changed')
      accessToken = manager.getAccessToken()
      if (!accessToken) throw new IamSessionError('no_access_token')
    }
    if (isBusinessReady && !isBusinessReady(context)) {
      throw new IamSessionError('authorization_pending')
    }
    requestContext.set(config, { ...manager.getContextSnapshot(), accessToken })
    config.headers.Authorization = `Bearer ${accessToken}`
    return config
  })

  const responseId = client.interceptors.response.use((response) => {
    const sent = requestContext.get(response?.config)
    if (sent?.contextId && (!manager.isSameContext(sent)
      || (isBusinessReady && !isBusinessReady(sent)))) {
      throw new IamSessionError('context_changed')
    }
    return response
  }, async (error) => {
    const config = error?.config
    const sent = config && requestContext.get(config)
    if (sent?.contextId && (!manager.isSameContext(sent)
      || (isBusinessReady && !isBusinessReady(sent)))) {
      throw new IamSessionError('context_changed')
    }
    if (error?.response?.status === 403 && config) {
      const route = routeFor(config)
      if (route && route !== '/users/me' && !BYPASS_ROUTES.has(route)
        && sent?.contextId && manager.isSameContext(sent)) {
        try {
          await onForbidden?.(sent)
        } catch (revalidationError) {
          console.warn('IAM revalidation failed', {
            status: Number.isInteger(revalidationError?.status)
              ? revalidationError.status : null,
          })
        }
      }
      throw error
    }
    if (error?.response?.status !== 401 || !config) throw error
    const route = routeFor(config)
    if (!route || BYPASS_ROUTES.has(route)) throw error
    if (!sent?.contextId) throw error
    if (config._iamRetried) {
      await manager.invalidateRejected(sent)
      throw error
    }
    if (!manager.isSameContext(sent)) throw new IamSessionError('context_changed')

    let accessToken = manager.getAccessToken()
    const rotated = manager.getContextSnapshot().tokenRevision !== sent.tokenRevision
    if (!accessToken || (!rotated && accessToken === sent.accessToken)) {
      accessToken = await manager.refresh()
    }
    if (!manager.isSameContext(sent)) throw new IamSessionError('context_changed')
    config._iamRetried = true
    config._iamRetryContext = { contextId: sent.contextId, generation: sent.generation }
    config.headers.Authorization = `Bearer ${accessToken}`
    return client.request(config)
  })

  return () => {
    client.interceptors.request.eject(requestId)
    client.interceptors.response.eject(responseId)
  }
}
