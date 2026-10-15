const icons = {
  success: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  ),
}

const variantStyles = {
  success: 'alert-success',
  error: 'alert-error',
  warning: 'alert-warning',
  info: 'alert-info',
}

const Alert = ({ variant = 'info', title, description, onClose }) => {
  const Icon = icons[variant]
  return (
    <div className={`alert ${variantStyles[variant]}`} role="alert">
      <div className="flex items-start gap-3">
        <span className="alert-icon">{Icon}</span>
        <div className="grow">
          {title ? <p className="text-sm font-semibold text-slate-900">{title}</p> : null}
          {description ? <p className="mt-1 text-sm text-slate-700">{description}</p> : null}
        </div>
        {onClose ? (
          <button type="button" className="alert-close" onClick={onClose} aria-label="Cerrar alerta">
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default Alert
