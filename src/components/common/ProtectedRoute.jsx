import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { routeDecision } from '../../services/auth/iamRoutePolicy.js'
import { authErrorMessage } from '../../services/auth/iamUi.js'
import OrganizationSelector from './OrganizationSelector.jsx'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const auth = useAuth()
  const location = useLocation()
  const decision = routeDecision(auth, allowedRoles)
  const handleLogout = () => {
    void auth.logout().catch(() => { /* El controlador publica el error recuperable. */ })
  }
  if (decision === 'loading') {
    return <div role="status" className="p-8 text-center">
      {auth.switching ? 'Cambiando organización…' : 'Cargando sesión…'}
    </div>
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
    return <div className="min-h-screen bg-slate-100 px-4 py-12">
      <OrganizationSelector standalone />
    </div>
  }
  if (decision === 'forbidden') {
    return <div role="alert" className="p-8 text-center">No tenés permiso para acceder a esta página.</div>
  }
  return children
}

export default ProtectedRoute
