import { isPlatformAdmin } from '../../utils/permissions'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getIamPermissions } from '../../services/auth/iamPermissions'

const platformLinks = [
  { label: 'Tenants', to: '/platform/tenants' },
  { label: 'Usuarios', to: '/platform/users' }
]

const links = [
  { label: 'Panel', to: '/dashboard', permission: 'canViewIntegrations' },
  { label: 'Integraciones', to: '/integrations', permission: 'canViewIntegrations' },
  { label: 'Ejecuciones', to: '/executions', permission: 'canViewExecutions' },
  { label: 'Incidentes', to: '/errors', permission: 'canViewExecutions' },
  { label: 'Configuración', to: '/settings', permission: 'canViewSettings' },
  { label: 'Usuarios', to: '/settings/users', permission: 'canViewUserAdmin' },
]

const Sidebar = () => {
  const auth = useAuth()
  const permissions = getIamPermissions(auth)
  const superadmin = isPlatformAdmin(auth.user) && !auth.user?.tenant_id
  const visibleLinks = superadmin
    ? platformLinks
    : links.filter((link) => permissions[link.permission])
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-slate-950 px-4 py-6 text-sm text-slate-300 shadow-soft lg:block">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{superadmin ? 'Consola de plataforma' : 'Área de trabajo'}</p>
        <h2 className="mt-3 text-xl font-semibold text-white">M-Connect</h2>
      </div>
      <nav className="space-y-2">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-3xl px-4 py-3 transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-900/70 hover:text-white'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
