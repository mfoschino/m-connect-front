import AuthLayout from '../../layouts/AuthLayout'
import LoginForm from '../../components/auth/LoginForm'

const LoginPage = () => {
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
