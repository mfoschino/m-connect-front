import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import userService from '../services/userService'

const idleStatus = { loading: false, message: '', type: 'idle' }

// useProfile centralizes profile state and persistence logic so pages stay lean.
// It keeps the authenticated user in sync with the shared auth context
// and provides clean save/password APIs for the profile UI.
const useProfile = () => {
  const { user, updateUser } = useAuth()

  const initialProfile = useMemo(
    () => ({
      name: user?.name || '',
      email: user?.email || '',
      avatarUrl: user?.avatarUrl || '',
    }),
    [user],
  )

  const [profile, setProfile] = useState(initialProfile)
  const [profileStatus, setProfileStatus] = useState(idleStatus)
  const [passwordStatus, setPasswordStatus] = useState(idleStatus)

  useEffect(() => {
    setProfile(initialProfile)
  }, [initialProfile])

  const saveProfile = async (profileData) => {
    setProfileStatus({ loading: true, message: '', type: 'idle' })

    try {
      const updatedUser = await userService.updateProfile(profileData)
      updateUser(updatedUser)
      setProfile(updatedUser)
      setProfileStatus({ loading: false, message: 'Perfil actualizado correctamente.', type: 'success' })
    } catch (error) {
      setProfileStatus({
        loading: false,
        message: error?.message || 'No se pudo actualizar el perfil.',
        type: 'error',
      })
    }
  }

  const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    setPasswordStatus({ loading: true, message: '', type: 'idle' })

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ loading: false, message: 'Las contraseñas no coinciden.', type: 'error' })
      return
    }

    try {
      const result = await userService.changePassword({ currentPassword, newPassword })
      setPasswordStatus({ loading: false, message: result.message, type: 'success' })
    } catch (error) {
      setPasswordStatus({
        loading: false,
        message: error?.message || 'No se pudo actualizar la contraseña.',
        type: 'error',
      })
    }
  }

  return {
    profile,
    setProfile,
    profileStatus,
    passwordStatus,
    saveProfile,
    changePassword,
  }
}

export default useProfile
