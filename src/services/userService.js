const PROFILE_DELAY_MS = 700

// Mock service functions keep the profile flow isolated from the UI.
// This is intentionally lightweight and respects the current app's mocked auth setup.
const updateProfile = (profileData) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      const normalizedEmail = profileData.email?.trim().toLowerCase()

      if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return reject({ message: 'Ingrese un correo electrónico válido.' })
      }

      if (!profileData.name?.trim()) {
        return reject({ message: 'El nombre es requerido.' })
      }

      resolve({
        name: profileData.name.trim(),
        email: normalizedEmail,
        avatarUrl: profileData.avatarUrl || '',
      })
    }, PROFILE_DELAY_MS)
  })

const changePassword = ({ currentPassword, newPassword }) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!currentPassword || !newPassword) {
        return reject({ message: 'La contraseña actual y la nueva contraseña son requeridas.' })
      }

      if (newPassword.length < 8) {
        return reject({ message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
      }

      if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return reject({ message: 'La contraseña debe incluir mayúsculas, minúsculas y números.' })
      }

      resolve({ message: 'Contraseña actualizada con éxito.' })
    }, PROFILE_DELAY_MS)
  })

export default {
  updateProfile,
  changePassword,
}
