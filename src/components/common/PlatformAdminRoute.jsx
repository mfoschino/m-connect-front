import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { isPlatformAdmin } from '../../utils/permissions'

const PlatformAdminRoute = ({ children }) => {
  const auth = useAuth()
  const location = useLocation()

  if (auth.bootstrapping || auth.switching) {
    return <div role="status" className="p-8 text-center">Cargando sesión…</div>
  }
  if (!auth.authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (!isPlatformAdmin(auth.user)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default PlatformAdminRoute
