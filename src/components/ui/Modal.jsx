const Modal = ({ open, title, onClose, children, footer }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            {title ? <h3 className="text-xl font-semibold text-slate-900">{title}</h3> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6">{children}</div>
        {footer ? <div className="border-t border-slate-200 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

export default Modal
