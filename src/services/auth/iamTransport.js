import {
  IamContractError,
  normalizeCurrentUser,
  normalizeLoginResponse,
  normalizeTokenPair,
} from './iamContracts.js'

export class IamTransportError extends Error {
  constructor(code, status = null, { detail = null, fieldErrors = [], source = 'none' } = {}) {
    super(code)
    this.name = 'IamTransportError'
    this.code = code
    this.status = status
    this.detail = detail
    this.fieldErrors = fieldErrors
    this.source = source
    this.displayMessage = detail ?? fieldErrors[0]?.message ?? {
      rejected: 'La solicitud no fue autorizada.',
      server_error: 'El servicio no está disponible en este momento.',
      network_error: 'No se pudo conectar con el servicio.',
      timeout: 'La solicitud tardó demasiado.',
      http_error: 'No se pudo completar la solicitud.',
    }[code]
  }
}

const safeText = (value, sensitiveValues = []) => {
  if (typeof value !== 'string') return null
  const text = value.trim()
  const hasControl = [...text].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  if (!text || text.length > 300 || hasControl
    || sensitiveValues.some((secret) => typeof secret === 'string'
      && secret.length > 0 && text.includes(secret))
    || /\b[A-Za-z0-9_-]{40,}\b/.test(text)
    || /bearer\s+\S+|(?:access|refresh|device)[_-]?token\s*[:=]/i.test(text)
    || /(?:password|otp|code|input_value)\s*[:=]/i.test(text)
    || /"(?:password|access_token|refresh_token|code)"\s*:/i.test(text)) {
    return null
  }
  return text
}

const safeDetails = (status, data, sensitiveValues) => {
  if (status >= 500 || !data || typeof data !== 'object' || Array.isArray(data)) return {}
  const detail = safeText(data.detail, sensitiveValues)
  if (detail) return { detail, source: 'detail' }
  if (Array.isArray(data.detail)) {
    const fieldErrors = data.detail.slice(0, 20).flatMap((item) => {
      if (!item || typeof item !== 'object' || !Array.isArray(item.loc)) return []
      const message = safeText(item.msg, sensitiveValues)
      const loc = item.loc.filter((part) =>
        (typeof part === 'string' && part.length <= 80
          && /^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) || Number.isInteger(part))
      if (!message || loc.length !== item.loc.length) return []
      const type = typeof item.type === 'string' && /^[a-z][a-z0-9_.]*$/.test(item.type)
        ? item.type : null
      return [{ loc, message, type }]
    })
    if (fieldErrors.length) return { fieldErrors, source: 'validation' }
  }
  const error = safeText(data.error, sensitiveValues)
  return error ? { detail: error, source: 'error' } : {}
}

export const normalizeIamError = (error, { sensitiveValues = [] } = {}) => {
  if (error instanceof IamContractError || error instanceof IamTransportError) return error
  const status = Number.isInteger(error?.response?.status) ? error.response.status : null
  const details = safeDetails(status, error?.response?.data, sensitiveValues)
  if (status === 401) return new IamTransportError('rejected', status, details)
  if (status >= 500) return new IamTransportError('server_error', status)
  if (status !== null) return new IamTransportError('http_error', status, details)
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return new IamTransportError('timeout')
  }
  return new IamTransportError('network_error')
}

const request = async (operation, sensitiveValues = []) => {
  try { return await operation() } catch (error) {
    throw normalizeIamError(error, { sensitiveValues })
  }
}

export const createIamTransport = (api) => {
  if (!api || typeof api.post !== 'function' || typeof api.get !== 'function') {
    throw new TypeError('Se requiere una instancia HTTP aislada.')
  }

  return {
    login: ({ email, password, deviceToken } = {}) => request(async () => {
      const body = { email, password }
      if (deviceToken) body.device_token = deviceToken
      const response = await api.post('/auth/login', body)
      return normalizeLoginResponse(response?.data)
    }, [password, deviceToken]),
    verifyOtp: ({ challengeId, code, rememberDevice } = {}) => request(async () => {
      const body = { challenge_id: challengeId, code }
      if (rememberDevice !== undefined) body.remember_device = rememberDevice
      const response = await api.post('/auth/login/otp', body)
      return normalizeLoginResponse(response?.data)
    }, [challengeId, code]),
    resendOtp: (challengeId) => request(async () => {
      const response = await api.post('/auth/login/otp/resend', { challenge_id: challengeId })
      const result = normalizeLoginResponse(response?.data)
      if (result.status !== 'otp_required') throw new IamContractError('invalid_otp_resend')
      return result
    }, [challengeId]),
    refresh: (refreshToken) => request(async () => {
      const response = await api.post('/auth/refresh', { refresh_token: refreshToken })
      return normalizeTokenPair(response?.data)
    }, [refreshToken]),
    getCurrentUser: (accessToken) => request(async () => {
      const response = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return normalizeCurrentUser(response?.data)
    }, [accessToken]),
    logout: (accessToken) => request(async () => {
      const response = await api.post('/auth/logout', undefined, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response?.status !== 204) throw new IamContractError('invalid_logout_response')
      return { revoked: true }
    }, [accessToken]),
  }
}
