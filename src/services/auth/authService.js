import axios from 'axios'
import apiClient from '../api/client'

const STORAGE_KEY = 'mconnect_session'

const authClient = axios.create({
  baseURL: apiClient.defaults.baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: apiClient.defaults.timeout,
})

const getDetailMessage = (data) => {
  const detail = data?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join(' ')
  }

  if (typeof data?.message === 'string') {
    return data.message
  }

  return ''
}

const buildAuthError = (error) => {
  if (error?.code) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return {
      code: 'network_error',
      message: 'No se pudo conectar con el servidor de autenticación.',
    }
  }

  const status = error.response?.status
  const message = getDetailMessage(error.response?.data)
  const normalizedMessage = message.toLowerCase()

  if (status === 401 || status === 400 || status === 422) {
    return {
      code: 'invalid_credentials',
      message: message || 'Correo electrónico o contraseña no válidos.',
    }
  }

  if (
    status === 403 &&
    (normalizedMessage.includes('bloque') ||
      normalizedMessage.includes('block') ||
      normalizedMessage.includes('inactiv') ||
      normalizedMessage.includes('disabled') ||
      normalizedMessage.includes('deshabilit'))
  ) {
    return {
      code: 'blocked_account',
      message: message || 'Tu cuenta está bloqueada. Contactá con soporte.',
    }
  }

  if (status === 403) {
    return {
      code: 'invalid_credentials',
      message: message || 'No se pudo validar la cuenta con esas credenciales.',
    }
  }

  return {
    code: 'network_error',
      message: message || 'No se pudo iniciar sesión. Intentá nuevamente.',
  }
}

const saveSession = (session) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Ignore storage errors in the browser session.
  }
}

const getCurrentUser = async (token) => {
  const response = await authClient.get('/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  return response.data
}

const login = async ({ email, password, remember }) => {
  try {
    const response = await authClient.post('/auth/login', {
      email,
      password,
    })
    const data = response.data

    if (!data?.access_token) {
      throw {
        code: 'invalid_response',
        message: 'El servidor no devolvió un token de acceso.',
      }
    }

    const user = await getCurrentUser(data.access_token)
    const session = {
      token: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      user,
      remember,
    }

    saveSession(session)

    return session
  } catch (error) {
    throw buildAuthError(error)
  }
}

export default {
  login,
}
