import apiClient from './api/client.js'
import { normalizeIamError } from './auth/iamTransport.js'

const updateProfile = async ({ name }) => {
  try {
    await apiClient.put('/users/me', { full_name: name.trim() })
  } catch (error) {
    throw normalizeIamError(error)
  }
}

const changePassword = async ({ currentPassword, newPassword }) => {
  try {
    await apiClient.post('/users/me/change-password', {
      current_password: currentPassword, new_password: newPassword,
    })
    return { message: 'Contraseña actualizada correctamente.' }
  } catch (error) {
    throw normalizeIamError(error, { sensitiveValues: [currentPassword, newPassword] })
  }
}

export default { updateProfile, changePassword }
