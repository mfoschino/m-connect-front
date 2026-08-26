import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import FinnegansCredentialsSettings from '../../components/settings/FinnegansCredentialsSettings'

const Settings = () => {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Configuración</p>
        <h2 className="section-title">Configuración de plataforma</h2>
        <p className="section-subtitle">
          Configura los ajustes del sistema para la plataforma M-Connect.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <FinnegansCredentialsSettings />

        <Card title="Ajustes del espacio de trabajo" description="Gestiona valores predeterminados operativos y políticas organizacionales.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Región predeterminada</p>
              <p className="mt-1">Este de EE. UU.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Zona horaria</p>
              <p className="mt-1">America/New_York</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Retención de datos</p>
              <p className="mt-1">90 días para registros de auditoría</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="secondary">Editar espacio de trabajo</Button>
          </div>
        </Card>

        <Card title="Preferencias de notificación" description="Ajusta cómo la plataforma notifica a tu equipo.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Alertas</p>
              <p className="mt-1">Notificaciones por correo y en la aplicación habilitadas.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Frecuencia de resumen</p>
              <p className="mt-1">Resumen diario a las 8:00.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Salud del sistema</p>
              <p className="mt-1">Alertas de estado operativo activas.</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="outline">Revisar reglas de notificación</Button>
          </div>
        </Card>

        <Card title="Cumplimiento" description="Revisa las políticas de seguridad y cumplimiento de la plataforma.">
          <div className="space-y-4 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">Política de sesiones</p>
              <p className="mt-1">Las sesiones inactivas expiran tras 30 minutos.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Control de acceso</p>
              <p className="mt-1">Acceso basado en roles configurado para tu equipo.</p>
            </div>
          </div>
          <div className="mt-6">
            <Button variant="outline">Revisar cumplimiento</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default Settings
