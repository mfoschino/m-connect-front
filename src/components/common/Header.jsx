import ProfileMenu from './ProfileMenu'
import NotificationsMenu from '../notifications/NotificationsMenu'

const Header = () => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-4 lg:px-4">
        <div>
          <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white">
            M-Connect
          </span>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">Plataforma de integración empresarial</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-2">Estado en vivo</span>
          <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">Operativo</span>
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}

export default Header
