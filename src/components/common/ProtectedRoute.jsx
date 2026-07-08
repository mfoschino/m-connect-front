import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { normalizeRole } from '../../services/api/userAdminService'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (allowedRoles?.length) {
    const userRole = normalizeRole(user.role)
    const allowed = allowedRoles.map(normalizeRole)

    if (!allowed.includes(userRole)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return children
}

export default ProtectedRoute
