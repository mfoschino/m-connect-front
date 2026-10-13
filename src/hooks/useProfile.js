import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import userService from '../services/userService'
import { authErrorMessage } from '../services/auth/iamUi.js'

const idleStatus = { loading: false, message: '', type: 'idle' }

// useProfile centralizes profile state and persistence logic so pages stay lean.
// It keeps the authenticated user in sync with the shared auth context
// and provides clean save/password APIs for the profile UI.
const useProfile = () => {
  const { user, reloadUser } = useAuth()

  const initialProfile = useMemo(
    () => ({
      name: user?.full_name || '',
      email: user?.email || '',
      avatarUrl: '',
    }),
    [user],
  )

  const [profile, setProfile] = useState(initialProfile)
  const [profileStatus, setProfileStatus] = useState(idleStatus)
  const [passwordStatus, setPasswordStatus] = useState(idleStatus)

  const saveProfile = async (profileData) => {
    setProfileStatus({ loading: true, message: '', type: 'idle' })

    try {
      await userService.updateProfile(profileData)
      const refreshed = await reloadUser()
      if (refreshed.status !== 'authenticated') throw new Error('profile_refresh_failed')
      setProfile({ name: refreshed.user.full_name || '', email: refreshed.user.email,
        avatarUrl: '' })
      setProfileStatus({ loading: false, message: 'Perfil actualizado correctamente.', type: 'success' })
    } catch (error) {
      setProfileStatus({
        loading: false,
        message: authErrorMessage(error),
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
        message: authErrorMessage(error),
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
