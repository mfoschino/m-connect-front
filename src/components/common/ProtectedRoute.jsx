import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { routeDecision } from '../../services/auth/iamRoutePolicy.js'
import { authErrorMessage } from '../../services/auth/iamUi.js'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const auth = useAuth()
  const location = useLocation()
  const decision = routeDecision(auth, allowedRoles)
  const handleLogout = () => {
    void auth.logout().catch(() => { /* El controlador publica el error recuperable. */ })
  }
  if (decision === 'loading') {
    return <div role="status" className="p-8 text-center">Cargando sesión…</div>
  }
  if (decision === 'login') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  if (decision === 'error') {
    return <div role="alert" className="mx-auto max-w-lg p-8 text-center">
      <p>{authErrorMessage(auth.error)}</p>
      {auth.status === 'recovery_required'
        ? <button type="button" className="btn btn-primary mt-4" onClick={handleLogout}>Cerrar sesión local</button>
        : <button type="button" className="btn btn-primary mt-4" onClick={auth.retry}>Reintentar</button>}
    </div>
  }
  if (decision === 'no_tenant') {
    return <div role="status" className="mx-auto max-w-lg p-8 text-center">
      <p>Tu cuenta está activa, pero no tiene una organización seleccionada. Contactá a un administrador.</p>
      <button type="button" className="btn btn-primary mt-4" onClick={handleLogout}>Cerrar sesión</button>
    </div>
  }
  if (decision === 'forbidden') {
    return <div role="alert" className="p-8 text-center">No tenés permiso para acceder a esta página.</div>
  }
  return children
}

export default ProtectedRoute
