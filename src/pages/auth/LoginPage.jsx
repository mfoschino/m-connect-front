import AuthLayout from '../../layouts/AuthLayout'
import LoginForm from '../../components/auth/LoginForm'

const LoginPage = () => {
  return (
    <AuthLayout
      title="Sign in to M-Connect"
      subtitle="Securely access your integration monitoring dashboard."
    >
      <LoginForm />
    </AuthLayout>
  )
}

export default LoginPage
