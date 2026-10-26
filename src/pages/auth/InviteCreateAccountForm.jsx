import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'
import { iamInviteToken } from '../../services/auth/iamRuntime.js'
import { invitationAcceptErrorMessage, validateNewPassword } from '../../services/auth/iamUi.js'

const InviteCreateAccountForm = ({ token, preview, onInvalid, onRecheck }) => {
  const { acceptInvitation } = useAuth()
  const navigate = useNavigate()

  // Evita que un doble clic envíe el formulario dos veces
  const pendingRef = useRef(false)

  const [form, setForm] = useState({
    fullName: '',
    password: '',
    confirmPassword: '',
    rememberSession: false,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (pendingRef.current) return
    setSubmitError('')

    // Mismas reglas que la recuperación de contraseña (y que el backend)
    const errors = validateNewPassword({
      password: form.password,
      confirmPassword: form.confirmPassword,
    })
    const fullName = form.fullName.trim()
    if (fullName.length > 100) {
      errors.fullName = 'El nombre no puede superar los 100 caracteres.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    pendingRef.current = true
    setSubmitting(true)

    try {
      await acceptInvitation({
        token,
        password: form.password,
        fullName: fullName || undefined,
        rememberSession: form.rememberSession,
      })
      // La invitación ya se usó: el token guardado no sirve más
      iamInviteToken.clear()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      pendingRef.current = false
      setSubmitting(false)

      const { message, fieldErrors: serverFieldErrors } = invitationAcceptErrorMessage(err, {
        email: preview.email,
      })

      if (err?.status === 410) {
        // El link dejó de servir mientras completaba el formulario
        onInvalid(message)
        return
      }

      if (err?.status === 409) {
        // O la cuenta ya existe, o el tenant se suspendió: volvemos a verificar
        onRecheck()
        return
      }

      setFieldErrors(serverFieldErrors)
      setSubmitError(message)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <p className="text-sm text-slate-600">Para aceptar, creá tu cuenta eligiendo una contraseña.</p>

      {submitError ? (
        <Alert variant="error" title="No se pudo crear la cuenta" description={submitError} />
      ) : null}

      <Input id="invite-email" label="Correo electrónico" value={preview.email} disabled />

      <Input
        id="invite-full-name"
        label="Nombre completo (opcional)"
        value={form.fullName}
        onChange={(event) => updateField('fullName', event.target.value)}
        error={fieldErrors.fullName}
        autoComplete="name"
        disabled={submitting}
      />

      <div className="space-y-2">
        <Input
          id="invite-password"
          label="Contraseña"
          type="password"
          value={form.password}
          onChange={(event) => updateField('password', event.target.value)}
          error={fieldErrors.password}
          autoComplete="new-password"
          disabled={submitting}
        />
        <p className="text-xs text-slate-500">
          Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número.
        </p>
      </div>

      <Input
        id="invite-confirm-password"
        label="Repetí la contraseña"
        type="password"
        value={form.confirmPassword}
        onChange={(event) => updateField('confirmPassword', event.target.value)}
        error={fieldErrors.confirmPassword}
        autoComplete="new-password"
        disabled={submitting}
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.rememberSession}
          onChange={(event) => updateField('rememberSession', event.target.checked)}
          disabled={submitting}
        />
        Recordar sesión en este dispositivo
      </label>

      <Button type="submit" className="w-full" loading={submitting}>
        Crear cuenta y aceptar
      </Button>
    </form>
  )
}

export default InviteCreateAccountForm