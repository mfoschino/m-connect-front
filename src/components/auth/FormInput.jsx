import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const FormInput = ({ id, label, error, type = 'text', disabled, ...props }) => {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className={isPassword ? 'relative' : undefined}>
        <input
          id={id}
          type={isPassword && passwordVisible ? 'text' : type}
          disabled={disabled}
          className={`form-input ${isPassword ? 'pr-12' : ''} ${error ? 'input-error' : ''}`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={`${passwordVisible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-slate-500 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {error ? <p id={`${id}-error`} className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

export default FormInput
