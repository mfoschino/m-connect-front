import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Si la página anterior dejó una nota con a dónde volver, la usa.
// Si no, vuelve a la dirección por defecto (la lista).
const BackLink = ({ fallbackTo, fallbackLabel }) => {
  const location = useLocation()
  const from = location.state?.from

  // Solo aceptamos notas que apunten a la consola
  const validFrom = typeof from?.pathname === 'string' && from.pathname.startsWith('/platform/')

  const to = validFrom ? from.pathname : fallbackTo
  const label = validFrom && from.label ? from.label : fallbackLabel

  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  )
}

export default BackLink