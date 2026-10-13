import { normalizeIamError } from './iamTransport.js'

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
})
