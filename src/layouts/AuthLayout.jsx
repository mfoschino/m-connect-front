const AuthLayout = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-slate-950/5 px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div className="space-y-6 text-center">
          <span className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white shadow-sm">
            M-Connect
          </span>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            <p className="mx-auto max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
          </div>
        </div>

        <div className="surface-card mx-auto w-full max-w-xl">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
