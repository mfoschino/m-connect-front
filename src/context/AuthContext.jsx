import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { acquireIamRuntime, iamAuth } from '../services/auth/iamRuntime.js'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const snapshot = useSyncExternalStore(iamAuth.subscribe, iamAuth.getState, iamAuth.getState)

  useEffect(() => {
    const release = acquireIamRuntime()
    void iamAuth.bootstrap()
    return release
  }, [])

  const value = useMemo(() => ({
    ...snapshot,
    authenticated: snapshot.status === 'authenticated' && Boolean(snapshot.user),
    bootstrapping: snapshot.status === 'bootstrapping',
    login: iamAuth.beginLogin,
    completeOtp: iamAuth.completeOtp,
    resendOtp: iamAuth.resendOtp,
    acceptInvitation: iamAuth.acceptInvitation,
    cancelOtp: iamAuth.cancelOtp,
    retry: iamAuth.retry,
    reloadUser: iamAuth.reloadUser,
    switchTenant: iamAuth.switchTenant,
    switching: snapshot.status === 'switching',
    logout: iamAuth.logout,
    invalidateAfterPasswordReset: iamAuth.invalidateAfterPasswordReset,
  }), [snapshot])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export default AuthContext
