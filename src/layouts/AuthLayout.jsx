const AuthLayout = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-center">
        <div className="space-y-6 text-center lg:text-left">
          <div className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-sm">
            M-Connect</div>
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
            <p className="max-w-xl text-sm text-slate-600 sm:text-base">{subtitle}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
