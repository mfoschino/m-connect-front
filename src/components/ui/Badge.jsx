const variantStyles = {
  online: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  offline: 'bg-slate-100 text-slate-700 border-slate-200',
  failed: 'bg-red-50 text-red-700 border-red-100',
  retrying: 'bg-amber-50 text-amber-700 border-amber-100',
  pending: 'bg-sky-50 text-sky-700 border-sky-100',
}

const Badge = ({ variant = 'pending', children, className = '' }) => {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
