// Límites del token según el backend (min_length=20, max_length=128)
const TOKEN_MIN_LENGTH = 20
const TOKEN_MAX_LENGTH = 128

// "#token=abc..." → "abc..." (o '' si no hay token o tiene un largo inválido)
export const readInviteToken = (hash) => {
  if (typeof hash !== 'string') return ''

  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token') || ''
  const validLength = token.length >= TOKEN_MIN_LENGTH && token.length <= TOKEN_MAX_LENGTH

  return validLength ? token : ''
}

const sameEmail = (a, b) =>
  typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase()

// Decide qué pantalla mostrar según la invitación y la sesión actual
export const decideInviteScreen = ({ preview, authenticated, user }) => {
  if (!preview.account_exists) {
    // Hay que crear la cuenta. Si hay otra sesión abierta, avisar antes.
    return authenticated && !sameEmail(user?.email, preview.email) ? 'create_other_session' : 'create'
  }

  if (!authenticated) return 'login_required'

  if (user?.platform_role === 'superadmin') return 'superadmin'

  if (!sameEmail(user?.email, preview.email)) return 'wrong_account'

  return 'accept_with_session'
}