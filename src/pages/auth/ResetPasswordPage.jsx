import { useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import FormInput from '../../components/auth/FormInput'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import { useAuth } from '../../context/AuthContext'
import { iamAccount } from '../../services/auth/iamRuntime.js'
import { authErrorMessage, isSixDigitCode,
  validateNewPassword } from '../../services/auth/iamUi.js'

const ResetPasswordPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { invalidateAfterPasswordReset } = useAuth()

  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    code: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)

  const validateForm = () => {
    const nextErrors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      nextErrors.email = 'Ingresá un correo electrónico válido.'
    }
    if (!isSixDigitCode(formData.code)) {
      nextErrors.code = 'Ingresá el código de seis dígitos.'
    }
    Object.assign(nextErrors, validateNewPassword(formData))

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
    if (pending.current) return
    setGeneralError('')

    if (!validateForm()) {
      return
    }

    pending.current = true
    setLoading(true)

    try {
      await iamAccount.resetPassword({ email: formData.email, code: formData.code,
        newPassword: formData.password })
      const cleanup = await invalidateAfterPasswordReset(formData.email)
      navigate('/login', { replace: true, state: {
        notice: cleanup.localCleared
          ? 'Contraseña actualizada. Iniciá sesión nuevamente.'
          : 'Contraseña actualizada, pero no se pudo confirmar la limpieza local. Borrá los datos de esta aplicación del navegador antes de ingresar.',
      } })
    } catch (err) {
      setGeneralError(authErrorMessage(err, 'reset'))
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Restablezca su Contraseña"
      subtitle="Ingresá tu correo, el código recibido y una nueva contraseña."
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        {generalError ? (
          <Alert
            variant="error"
            title="Error"
            description={generalError}
          />
        ) : null}

        <FormInput id="reset-email" label="Correo electrónico" type="email" name="email"
          value={formData.email} onChange={handleChange} autoComplete="email"
          disabled={loading} error={errors.email} />
        <FormInput id="reset-code" label="Código de seis dígitos" name="code"
          inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          value={formData.code} onChange={(event) => setFormData((prev) => ({ ...prev,
            code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
          disabled={loading} error={errors.code} />

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
          Restablecer contraseña
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
