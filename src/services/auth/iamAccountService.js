import { normalizeIamError } from './iamTransport.js'
import { normalizeInvitationAcceptResult, normalizeInvitationPreview } from './iamContracts.js'
import { IamSessionError } from './iamSession.js'

export const createIamAccountService = (api) => ({
  async forgotPassword(email) {
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() })
    } catch (error) {
      throw normalizeIamError(error)
    }
  },
  async resetPassword({ email, code, newPassword }) {
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(), code, new_password: newPassword,
      })
    } catch (error) {
      throw normalizeIamError(error, { sensitiveValues: [code, newPassword] })
    }
  },
  async inspectInvitation(token) {
    try {
      const response = await api.post('/auth/invitations/inspect', { token })
      return normalizeInvitationPreview(response?.data)
    } catch (error) {
      throw normalizeIamError(error, { sensitiveValues: [token] })
    }
  },
  async acceptInvitationWithSession(token) {
    try {
      // Tras un 401 no se reenvía: el resultado queda sin confirmar, como en IAM-4C.
      const response = await api.post('/users/me/invitations/accept', { token },
        { _iamSkipAuthRetry: true })
      return normalizeInvitationAcceptResult(response?.data)
    } catch (error) {
      // Los rechazos locales del interceptor (authorization_pending, context_changed) no son de red.
      if (error instanceof IamSessionError) throw error
      throw normalizeIamError(error, { sensitiveValues: [token] })
    }
  },
})
