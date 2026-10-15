export class IamContractError extends Error {
  constructor(code) {
    super(code)
    this.name = 'IamContractError'
    this.code = code
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmpty = (value) => typeof value === 'string' && value.length > 0
const nullableText = (value) => value === null || typeof value === 'string'
const positiveSeconds = (value) => Number.isInteger(value) && value > 0
const nonNegativeSeconds = (value) => Number.isInteger(value) && value >= 0
const bearer = (value) => typeof value === 'string' && value.toLowerCase() === 'bearer'
const validMembership = (value) => isObject(value) && nonEmpty(value.tenant_id)
  && typeof value.tenant_name === 'string' && typeof value.role === 'string'
  && typeof value.status === 'string'
  && typeof value.tenant_is_active === 'boolean'
const validSupport = (value) => value === null || (isObject(value)
  && nonEmpty(value.id) && nonEmpty(value.tenant_id)
  && typeof value.tenant_name === 'string' && typeof value.access_level === 'string'
  && nonEmpty(value.expires_at))

export const normalizeTokenPair = (data) => {
  if (!isObject(data) || !nonEmpty(data.access_token) || !nonEmpty(data.refresh_token)
    || !bearer(data.token_type) || !positiveSeconds(data.expires_in)) {
    throw new IamContractError('invalid_token_pair')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    expiresIn: data.expires_in,
  }
}

export const normalizeLoginResponse = (data) => {
  if (!isObject(data)) throw new IamContractError('invalid_login_response')

  if (data.status === 'otp_required') {
    if (!nonEmpty(data.challenge_id) || !nonEmpty(data.email_hint)
      || !nonNegativeSeconds(data.otp_expires_in) || !bearer(data.token_type)
      || data.access_token || data.refresh_token) {
      throw new IamContractError('invalid_otp_challenge')
    }
    return {
      status: 'otp_required',
      challengeId: data.challenge_id,
      emailHint: data.email_hint,
      otpExpiresIn: data.otp_expires_in,
      tokenType: data.token_type,
    }
  }

  // La API anterior devuelve el par sin `status`; sigue requiriendo ambos tokens.
  if (data.status === 'authenticated'
    || (data.status === undefined && nonEmpty(data.access_token)
      && nonEmpty(data.refresh_token))) {
    const pair = normalizeTokenPair(data)
    if (data.device_token != null && !nonEmpty(data.device_token)) {
      throw new IamContractError('invalid_device_token')
    }
    return { status: 'authenticated', ...pair, deviceToken: data.device_token ?? null }
  }

  throw new IamContractError('unknown_login_status')
}

export const normalizeCurrentUser = (data) => {
  // El perfil anterior no incluye estos tres campos; no se infieren membresías.
  const legacy = isObject(data) && !('memberships' in data)
    && !('support_session' in data) && !('platform_role' in data)
  const user = legacy ? { ...data, memberships: [], support_session: null,
    platform_role: null } : data
  if (!isObject(user) || !nonEmpty(user.id) || !nonEmpty(user.email)
    || typeof user.is_active !== 'boolean' || typeof user.is_verified !== 'boolean'
    || !(user.last_login === null || nonEmpty(user.last_login))
    || !nonEmpty(user.created_at) || !nonEmpty(user.updated_at)
    || !Array.isArray(user.memberships) || !user.memberships.every(validMembership)
    || !nullableText(user.full_name) || !nullableText(user.tenant_id)
    || !nullableText(user.role) || !nullableText(user.platform_role)
    || !validSupport(user.support_session)) {
    throw new IamContractError('invalid_current_user')
  }
  return { ...user }
}
