import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'mconnect_session'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_KEY)

      if (!savedSession) {
        return
      }

      const parsedSession = JSON.parse(savedSession)

      if (parsedSession?.user) {
        setUser(parsedSession.user)
      }

      if (parsedSession?.token) {
        setToken(parsedSession.token)
      }
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const login = (session) => {
    setUser(session?.user ?? null)
    setToken(session?.token ?? null)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } catch (error) {
      // Ignore storage errors in the browser session.
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)

    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      // Ignore storage errors in the browser session.
    }
  }

  const value = useMemo(
    () => ({ user, token, login, logout }),
    [user, token],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}

export default AuthContext