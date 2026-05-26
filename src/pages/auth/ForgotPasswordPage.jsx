import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import FormInput from '../../components/auth/FormInput'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

const ForgotPasswordPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validateEmail = (emailValue) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(emailValue)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('Email es requerido.')
      return
    }

    if (!validateEmail(email)) {
      setError('Ingrese una dirección de email válida.')
      return
    }

    setLoading(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Store email in session storage for next page
      sessionStorage.setItem('forgotPasswordEmail', email)

      setSubmitted(true)
      setTimeout(() => {
        navigate('/forgot-password-sent')
      }, 1000)
    } catch (err) {
      setError('Error al procesar su solicitud. Intente de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <AuthLayout
        title="¡Correo Enviado!"
        subtitle="Hemos enviado un enlace de restablecimiento a su correo electrónico."
      >
        <div className="space-y-6 text-center">
          <p className="text-sm text-slate-600">Redirigiendo...</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="¿Olvidó su contraseña?"
      subtitle="Ingrese su correo electrónico para recibir un enlace de restablecimiento."
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
          Enviar Enlace de Restablecimiento
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
