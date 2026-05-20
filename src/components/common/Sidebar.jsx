import { NavLink } from 'react-router-dom'

const links = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Integrations', to: '/integrations' },
  { label: 'Executions', to: '/executions' },
  { label: 'Errors', to: '/errors' },
  { label: 'Settings', to: '/settings' },
]

const Sidebar = () => {
  return (
    <aside className="w-64 border-r border-slate-200 bg-white p-6">
      <nav className="space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `block rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
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
