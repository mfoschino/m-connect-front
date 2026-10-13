import { Link, useLocation } from 'react-router-dom'
import AuthLayout from '../../layouts/AuthLayout'
import Button from '../../components/ui/Button'

const ForgotPasswordSentPage = () => {
  const email = useLocation().state?.email || ''

  return (
    <AuthLayout
      title="Revise su correo electrónico"
      subtitle="Si la cuenta existe, recibirás un código de recuperación."
    >
      <div className="space-y-6">
        <div className="rounded-lg bg-slate-50 p-4 text-center">
          <p className="text-sm text-slate-700">
            Revisá la casilla de correo indicada:
          </p>
          <p className="mt-2 font-medium text-slate-900">
            {email || 'su correo electrónico'}
          </p>
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Si recibís el código, ingresalo en el formulario de restablecimiento.
            Revisá también la carpeta de spam.
          </p>
          <p>
            Si no recibió el correo, puede intentar:
          </p>
          <ul className="ml-4 list-inside list-disc space-y-1">
            <li>Verificar su carpeta de spam</li>
            <li>Intentar con otra dirección de correo</li>
            <li>Contactar al soporte</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link to="/reset-password" state={{ email }} className="block">
            <Button className="w-full">
              Tengo el Código de Restablecimiento
            </Button>
          </Link>

          <Link to="/forgot-password" className="block">
            <Button variant="outline" className="w-full">
              Enviar Otro Correo
            </Button>
          </Link>

          <Link to="/login" className="block">
            <Button variant="ghost" className="w-full">
              Volver a Iniciar Sesión
            </Button>
          </Link>
        </div>
      </div>
    </AuthLayout>
  )
}

export default ForgotPasswordSentPage
