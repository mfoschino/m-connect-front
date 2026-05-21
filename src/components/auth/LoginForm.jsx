import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormInput from './FormInput'
import authService from '../../services/auth/authService'

const LoginForm = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember: false,
  })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const nextErrors = {}
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(formData.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required.'
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.'
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

    setSubmitting(true)

    try {
      await authService.login(formData)
      navigate('/dashboard')
    } catch (error) {
      if (error?.code === 'invalid_credentials') {
        setGeneralError('Invalid credentials. Please check your email and password.')
      } else if (error?.code === 'blocked_account') {
        setGeneralError('Your account is blocked. Contact support for assistance.')
      } else {
        setGeneralError('Unable to sign in. Please check your network connection and try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      {generalError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm transition duration-200">
          {generalError}
        </div>
      ) : null}

      <FormInput
        id="login-email"
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="you@company.com"
        autoComplete="email"
        error={errors.email}
      />

      <FormInput
        id="login-password"
        label="Password"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Enter your password"
        autoComplete="current-password"
        error={errors.password}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="remember"
            checked={formData.remember}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
          Remember session
        </label>
        <a
          href="#"
          onClick={(event) => event.preventDefault()}
          className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
        >
          Forgot password?
        </a>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
      >
        {submitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}

export default LoginForm
