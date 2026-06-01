import { NavLink } from 'react-router-dom'

const links = [
  { label: 'Panel', to: '/dashboard' },
  { label: 'Integraciones', to: '/integrations' },
  { label: 'Ejecuciones', to: '/executions' },
  { label: 'Incidentes', to: '/errors' },
  { label: 'Configuración', to: '/settings' },
]

const Sidebar = () => {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 px-5 py-6 text-sm text-slate-300 shadow-soft lg:block">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Área de trabajo</p>
        <h2 className="mt-3 text-xl font-semibold text-white">M-Connect</h2>
      </div>
      <nav className="space-y-2">
        {links.map((link) => (
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
