const variantStyles = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const Button = ({ children, variant = 'primary', loading = false, className = '', ...props }) => {
  const variantClass = variantStyles[variant] ?? variantStyles.primary
  return (
    <button
      className={`btn ${variantClass} ${className}`}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
