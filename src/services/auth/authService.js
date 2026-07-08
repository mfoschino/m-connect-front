const AUTH_DELAY_MS = 900

const mockUsers = [
  {
    email: 'admin@mconnect.com',
    password: 'Password123',
    status: 'active',
    role: 'admin',
    id: 'mock-admin-user',
    tenant_id: 'mock-tenant',
  },
  {
    email: 'blocked@mconnect.com',
    password: 'Password123',
    status: 'blocked',
    role: 'viewer',
    id: 'mock-blocked-user',
    tenant_id: 'mock-tenant',
  },
]

const login = ({ email, password, remember }) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'network@error.com') {
        return reject({ code: 'network_error', message: 'Error de red. Por favor, inténtalo de nuevo.' })
      }

      const user = mockUsers.find((record) => record.email === email)

      if (!user || user.password !== password) {
        return reject({ code: 'invalid_credentials', message: 'Correo electrónico o contraseña inválidos.' })
      }

      if (user.status === 'blocked') {
        return reject({ code: 'blocked_account', message: 'Tu cuenta está bloqueada. Contacta con soporte.' })
      }

      const session = {
        token: 'mock-session-token',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenant_id: user.tenant_id,
        },
        remember,
      }

      try {
        localStorage.setItem('mconnect_session', JSON.stringify(session))
      } catch {
        // ignore storage errors in mock environment
      }

      resolve(session)
    }, AUTH_DELAY_MS)
  })
}

export default {
  login,
}
