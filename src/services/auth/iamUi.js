export const isSixDigitCode = (value) => /^\d{6}$/.test(value)

export const safeDestination = (from) => {
  const path = typeof from === 'string' ? from : from?.pathname
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')
    || path.includes('\\') || [...path].some((character) => character.charCodeAt(0) < 32)
    || ['/login', '/forgot-password', '/forgot-password-sent', '/reset-password'].includes(path)) {
    return '/dashboard'
  }
  return path
}

export const authErrorMessage = (error, flow = 'session') => {
  if (error?.name === 'IamCapabilityError') {
    return 'Este navegador o conexión no permite una sesión segura. Usá HTTPS y un navegador con Web Locks y almacenamiento habilitados.'
  }
  if (error?.code === 'local_cleanup_uncertain') {
    return 'No se pudo confirmar la limpieza local de la sesión. Cerrá todas las pestañas de esta aplicación y borrá sus datos del navegador antes de volver a ingresar.'
  }
  if (error?.code === 'refresh_state_uncertain' || error?.code === 'refresh_outcome_unknown'
    || error?.code === 'refresh_server_uncertain') {
    return 'No se pudo confirmar la sesión. Volvé a iniciar sesión.'
  }
  if (error?.code === 'network_error' || error?.code === 'timeout') {
    return 'No se pudo conectar con el servicio. Revisá tu conexión e intentá de nuevo.'
  }
  if (error?.status === 429) return 'Demasiados intentos. Esperá antes de volver a intentar.'
  if (flow === 'login' && error?.status === 401) return 'Correo o contraseña incorrectos.'
  if (flow === 'otp' && error?.status === 400) return 'Código incorrecto o vencido. Solicitá otro si es necesario.'
  if (flow === 'reset' && error?.status === 400) return 'Código incorrecto o vencido. Solicitá uno nuevo.'
  if (error?.status === 422) return 'Revisá los datos ingresados y volvé a intentar.'
  if (error?.status === 403) return 'No tenés permiso para realizar esta acción o la cuenta está bloqueada.'
  if (error?.status === 401) return 'La sesión dejó de estar vigente. Volvé a iniciar sesión.'
  return 'No se pudo completar la operación. Intentá de nuevo.'
}
