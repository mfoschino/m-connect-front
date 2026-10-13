import AuthLayout from '../../layouts/AuthLayout'
import LoginForm from '../../components/auth/LoginForm'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { safeDestination } from '../../services/auth/iamUi.js'
import { useLocation } from 'react-router-dom'

const LoginPage = () => {
  const auth = useAuth()
  const location = useLocation()
  if (auth.bootstrapping && !auth.hasBootstrapped) {
    return <div role="status" className="p-8 text-center">Cargando sesión…</div>
  }
  if (auth.authenticated) return <Navigate to={safeDestination(location.state?.from)} replace />
  return (
    <AuthLayout
      title="Inicia sesión en M-Connect"
      subtitle="Todo el monitoreo de tus integraciones, en un solo lugar."
    >
      <LoginForm />
    </AuthLayout>
  )
}

export default LoginPage
