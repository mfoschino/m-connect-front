import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import FormInput from './FormInput'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { useAuth } from '../../context/AuthContext'
import { authErrorMessage, isSixDigitCode, safeDestination } from '../../services/auth/iamUi.js'

const LoginForm = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, completeOtp, resendOtp, cancelOtp, status, error: sessionError, logoutResult } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberSession: false,
    rememberDevice: false,
  })
  const [challenge, setChallenge] = useState(null)
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [resendAfter, setResendAfter] = useState(0)
  const [now, setNow] = useState(0)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const pending = useRef(false)
  const challengeRef = useRef(null)
  const intentRevision = useRef(0)

  useEffect(() => () => {
    intentRevision.current += 1
    if (challengeRef.current) void cancelOtp().catch(() => {})
  }, [cancelOtp])

  useEffect(() => {
    if (!challenge) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [challenge])

  const applyChallenge = (result) => {
    challengeRef.current = result
    setChallenge(result)
    setCode('')
    const current = Date.now()
    setNow(current)
    setExpiresAt(current + result.otpExpiresIn * 1000)
    setResendAfter(current + 30000)
  }

  const validate = () => {
    const nextErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!formData.email.trim()) {
      nextErrors.email = 'Correo electrónico requerido.'
    } else if (!emailPattern.test(formData.email)) {
      nextErrors.email = 'Ingrese una dirección de correo electrónico válida.'
    }

    if (!formData.password) {
      nextErrors.password = 'Contraseña requerida.'
    } else if (formData.password.length < 8) {
      nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setGeneralError('')

    if (!validate()) {
      return
    }

    if (pending.current) return
    pending.current = true
    setSubmitting(true)
    const revision = intentRevision.current

    try {
      const result = await login({ email: formData.email, password: formData.password,
        rememberSession: formData.rememberSession })
      if (revision !== intentRevision.current) return
      if (result.status === 'otp_required') applyChallenge(result)
      else navigate(safeDestination(location.state?.from), { replace: true })
    } catch (error) {
      if (revision === intentRevision.current) setGeneralError(authErrorMessage(error, 'login'))
    } finally {
      if (revision === intentRevision.current) {
        pending.current = false
        setSubmitting(false)
      }
    }
  }

  const handleOtp = async (event) => {
    event.preventDefault()
    if (pending.current) return
    setGeneralError('')
    if (!isSixDigitCode(code)) {
      setGeneralError('Ingresá un código de seis dígitos.')
      return
    }
    if (Date.now() >= expiresAt) {
      setGeneralError('El código venció. Solicitá uno nuevo.')
      return
    }
    pending.current = true
    setSubmitting(true)
    const revision = intentRevision.current
    try {
      await completeOtp({ email: formData.email, challengeId: challenge.challengeId,
        code, rememberSession: formData.rememberSession,
        rememberDevice: formData.rememberDevice })
      if (revision !== intentRevision.current) return
      challengeRef.current = null
      setCode('')
      navigate(safeDestination(location.state?.from), { replace: true })
    } catch (error) {
      if (revision === intentRevision.current) setGeneralError(authErrorMessage(error, 'otp'))
    } finally {
      if (revision === intentRevision.current) {
        pending.current = false
        setSubmitting(false)
      }
    }
  }

  const handleResend = async () => {
    if (pending.current || now < resendAfter) return
    pending.current = true
    setResending(true)
    setGeneralError('')
    const revision = intentRevision.current
    try {
      const result = await resendOtp(challenge.challengeId)
      if (revision === intentRevision.current) applyChallenge(result)
    } catch (error) {
      if (revision === intentRevision.current) {
        setGeneralError(authErrorMessage(error, 'otp'))
        if (error?.status === 429) setResendAfter(Date.now() + 30000)
      }
    } finally {
      if (revision === intentRevision.current) {
        pending.current = false
        setResending(false)
      }
    }
  }

  const handleBack = () => {
    intentRevision.current += 1
    challengeRef.current = null
    pending.current = false
    setChallenge(null)
    setCode('')
    setGeneralError('')
    setSubmitting(false)
    setResending(false)
    void cancelOtp().catch((error) => setGeneralError(authErrorMessage(error)))
  }

  if (challenge) return (
    <form className="space-y-6" onSubmit={handleOtp} noValidate>
      <p className="text-sm text-slate-600">Ingresá el código enviado a {challenge.emailHint}.</p>
      {generalError && <Alert variant="error" title="Verificación" description={generalError} />}
      <FormInput id="login-otp" label="Código de seis dígitos" inputMode="numeric"
        autoComplete="one-time-code" maxLength={6} value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
      <p className="text-sm text-slate-600">{now >= expiresAt
        ? 'El código venció. Solicitá uno nuevo.'
        : `El código vence en ${Math.ceil((expiresAt - now) / 1000)} segundos.`}</p>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={formData.rememberDevice}
          onChange={(event) => setFormData((prev) => ({ ...prev,
            rememberDevice: event.target.checked }))} />
        Recordar este dispositivo (evitar OTP en próximos ingresos con contraseña)
      </label>
      <Button type="submit" loading={submitting} className="w-full">Verificar código</Button>
      <button type="button" onClick={handleResend} disabled={resending || now < resendAfter}
        className="text-sm font-medium text-slate-700 disabled:text-slate-400">
        {resending ? 'Reenviando…' : now < resendAfter
          ? `Reenviar en ${Math.ceil((resendAfter - now) / 1000)} s` : 'Reenviar código'}
      </button>
      <p className="text-xs text-slate-500">El servidor puede requerir más espera antes de reenviar.</p>
      <button type="button" className="block text-sm text-slate-700" onClick={handleBack}>Volver al ingreso</button>
    </form>
  )

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {location.state?.notice ? <Alert variant="info" title="Sesión" description={location.state.notice} /> : null}
      {logoutResult ? <Alert variant="info" title="Sesión" description={logoutResult.revoked
        ? 'Sesión cerrada.'
        : 'Se cerró la sesión local. No se pudo confirmar la revocación remota.'} /> : null}
      {(generalError || status === 'unsupported' || status === 'recovery_required') ? (
        <Alert
          variant="error"
          title="Autenticación fallida"
          description={generalError || authErrorMessage(sessionError)}
        />
      ) : null}

      <FormInput
        id="login-email"
        label="Correo electrónico"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="tu@empresa.com"
        autoComplete="email"
        error={errors.email}
      />

      <FormInput
        id="login-password"
        label="Contraseña"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Ingrese contraseña"
        autoComplete="current-password"
        error={errors.password}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="rememberSession"
            checked={formData.rememberSession}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
          Recordar sesión
        </label>
        <Link
          to="/forgot-password"
          className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
        >
          Recuperar contraseña
        </Link>
      </div>

      <Button type="submit" loading={submitting} className="w-full">
        {submitting ? 'Por favor aguarde...' : 'Iniciar sesión'}
      </Button>
    </form>
  )
}

export default LoginForm
