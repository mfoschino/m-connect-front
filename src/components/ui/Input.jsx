const Input = ({ id, label, error, helperText, className = '', ...props }) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {label ? (
        <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        className={`form-input w-full ${error ? 'input-error' : ''}`}
        aria-invalid={Boolean(error)}
        aria-describedby={helperText ? `${id}-hint` : undefined}
        {...props}
      />
      {helperText ? (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
          {helperText}
        </p>
      ) : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  )
}

export default Input
