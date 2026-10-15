import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import FormInput from '../../components/auth/FormInput'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import { iamAccount } from '../../services/auth/iamRuntime.js'
import { authErrorMessage } from '../../services/auth/iamUi.js'

const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)

  const validateEmail = (emailValue) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(emailValue)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pending.current) return
    setError('')

    if (!email.trim()) {
      setError('Correo electrónico es requerido.')
      return
    }

    if (!validateEmail(email)) {
      setError('Ingrese una dirección de correo electrónico válida.')
      return
    }

    pending.current = true
    setLoading(true)

    try {
      await iamAccount.forgotPassword(email)
      navigate('/forgot-password-sent', { state: { email: email.trim().toLowerCase() } })
    } catch (err) {
      setError(authErrorMessage(err, 'forgot'))
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="¿Olvidó su contraseña?"
      subtitle="Ingresá tu correo electrónico para solicitar un código de recuperación."
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {error ? (
          <Alert variant="error" title="Error" description={error} />
        ) : null}

        <FormInput
          id="forgot-email"
          label="Correo Electrónico"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@empresa.com"
          autoComplete="email"
          disabled={loading}
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Enviar código de recuperación
        </Button>

        <div className="text-center">
          <Link
            to="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Volver a Iniciar Sesión
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}

export default ForgotPasswordPage
