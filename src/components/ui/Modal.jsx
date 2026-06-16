const Modal = ({ open, title, subtitle, onClose, children, footer, size = 'default' }) => {
  if (!open) return null

  const sizeClasses = {
    default: 'max-w-4xl',
    large: 'w-[90vw] max-h-[90vh]',
  }

  const headerPadding = size === 'large' ? 'px-8 py-7' : 'px-6 py-5'
  const contentPadding = size === 'large' ? 'px-8 py-8' : 'px-6 py-6'
  const contentHeight = size === 'large' ? 'max-h-[calc(90vh-14rem)]' : 'max-h-[calc(100vh-8rem)]'
  const footerPadding = size === 'large' ? 'px-8 py-6' : 'px-6 py-4'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className={`w-full ${sizeClasses[size]} overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/10 flex flex-col`}>
        {/* Header */}
        <div className={`flex items-start justify-between border-b border-slate-200 ${headerPadding}`}>
          <div className="flex-1">
            {title ? <h2 className={size === 'large' ? 'text-2xl font-bold text-slate-900' : 'text-xl font-semibold text-slate-900'}>{title}</h2> : null}
            {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${contentPadding} ${contentHeight}`}>{children}</div>
        {/* Footer */}
        {footer ? <div className={`border-t border-slate-200 ${footerPadding}`}>{footer}</div> : null}
      </div>
    </div>
  )
}

export default Modal
