import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import FormInput from '../../components/auth/FormInput'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Mock token validation
  const isTokenValid = () => {
    // In a real app, validate against backend
    // For this mock, we accept any token format or no token
    // and show expiration after multiple attempts
    return true
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!formData.password) {
      nextErrors.password = 'Nueva contraseña es requerida.'
    } else if (formData.password.length < 8) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    } else if (!/[A-Z]/.test(formData.password)) {
      nextErrors.password = 'Debe incluir al menos una letra mayúscula.'
    } else if (!/[a-z]/.test(formData.password)) {
      nextErrors.password = 'Debe incluir al menos una letra minúscula.'
    } else if (!/[0-9]/.test(formData.password)) {
      nextErrors.password = 'Debe incluir al menos un número.'
    }

    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirmar contraseña es requerida.'
    } else if (formData.password !== formData.confirmPassword) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGeneralError('')

    if (!isTokenValid()) {
      setGeneralError(
        'Su enlace de restablecimiento ha expirado. Solicite uno nuevo.'
      )
      return
    }

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))

      setSubmitted(true)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setGeneralError('Error al restablece su contraseña. Intente de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!isTokenValid()) {
    return (
      <AuthLayout
        title="Enlace Expirado"
        subtitle="Su enlace de restablecimiento no es válido o ha expirado."
      >
        <div className="space-y-6">
          <Alert
            variant="error"
            title="Token Inválido"
            description="Los enlaces de restablecimiento son válidos por 24 horas. Solicite uno nuevo para continuar."
          />

          <div className="space-y-3">
            <Link to="/forgot-password" className="block">
              <Button className="w-full">
                Solicitar Nuevo Enlace
              </Button>
            </Link>

            <Link to="/login" className="block">
              <Button variant="outline" className="w-full">
                Volver a Iniciar Sesión
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  if (submitted) {
    return (
      <AuthLayout
        title="¡Contraseña Restablecida!"
        subtitle="Su contraseña ha sido actualizada exitosamente."
      >
        <div className="space-y-6 text-center">
          <Alert
            variant="success"
            title="Éxito"
            description="Será redirigido a la página de inicio de sesión."
          />
          <p className="text-sm text-slate-600">Redirigiendo...</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Restablezca su Contraseña"
      subtitle="Ingrese su nueva contraseña."
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {generalError ? (
          <Alert
            variant="error"
            title="Error"
            description={generalError}
          />
        ) : null}

        <FormInput
          id="new-password"
          label="Nueva Contraseña"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="••••••••"
          disabled={loading}
          error={errors.password}
        />

        <FormInput
          id="confirm-password"
          label="Confirmar Contraseña"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="••••••••"
          disabled={loading}
          error={errors.confirmPassword}
        />

        <div className="text-xs text-slate-500">
          <p className="font-medium text-slate-600">Requisitos de contraseña:</p>
          <ul className="mt-2 space-y-1">
            <li
              className={`${
                formData.password.length >= 8 ? 'text-green-600' : ''
              }`}
            >
              • Al menos 8 caracteres
            </li>
            <li
              className={`${
                /[A-Z]/.test(formData.password) ? 'text-green-600' : ''
              }`}
            >
              • Una letra mayúscula
            </li>
            <li
              className={`${
                /[a-z]/.test(formData.password) ? 'text-green-600' : ''
              }`}
            >
              • Una letra minúscula
            </li>
            <li
              className={`${
                /[0-9]/.test(formData.password) ? 'text-green-600' : ''
              }`}
            >
              • Un número
            </li>
          </ul>
        </div>

        <Button
          type="submit"
          loading={loading}
          className="w-full"
        >
          Restablacer Contraseña
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

export default ResetPasswordPage
