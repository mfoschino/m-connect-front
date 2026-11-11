import { useEffect, useState } from 'react'
import platformService from '../../services/api/platformService'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { formatDate } from './platformUtils'
import { describeTargetLocally } from './auditUtils'

// Nombres legibles de los campos de "details" que conocemos.
// Si llega uno que no está acá, se muestra el nombre tal cual.
const DETAIL_LABELS = {
  before: 'Antes',
  after: 'Después',
  email: 'Email',
  reason: 'Motivo',
  access_level: 'Nivel de acceso',
  minutes: 'Duración (minutos)',
  method: 'Método',
  path: 'Ruta',
  fields: 'Campos modificados',
  second_factor: 'Segundo factor',
  role: 'Rol',
  via: 'Origen',
  name: 'Nombre',
  plan: 'Plan',
}

// Traducción de valores, solo para los campos donde tiene sentido
const TRANSLATED_FIELDS = ['before', 'after', 'role', 'via']

const VALUE_LABELS = {
  active: 'Activo',
  disabled: 'Deshabilitado',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
  invitation: 'Invitación',
}

// Convierte cualquier valor en un texto que se pueda mostrar
const formatValue = (value) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// Una fila de "nombre: valor"
const DetailRow = ({ label, children }) => (
  <div className="grid gap-1 sm:grid-cols-3">
    <dt className="text-sm text-slate-500">{label}</dt>
    <dd className="break-all text-sm text-slate-900 sm:col-span-2">{children}</dd>
  </div>
)

const AuditLogDetailModal = ({ log, actionLabel, actorKindLabel, tenantName, tenantNames, onClose }) => {
  const details = log.details && typeof log.details === 'object' ? Object.entries(log.details) : []

  const [targetUser, setTargetUser] = useState(null)
  const [targetUserFailed, setTargetUserFailed] = useState(false)

  // Lo que podemos decir del afectado sin pedir nada
  const localTarget = describeTargetLocally(log, tenantNames)
  const needsFetch = localTarget === null

  // Solo si no alcanza con lo que tenemos, pedimos el usuario
  useEffect(() => {
    if (!needsFetch) return undefined

    let cancelled = false

    platformService
      .getUser(log.target_id)
      .then((response) => {
        if (!cancelled) setTargetUser(response.data)
      })
      .catch(() => {
        if (!cancelled) setTargetUserFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [needsFetch, log.target_id])

  const renderTarget = () => {
    if (!needsFetch) return localTarget
    if (targetUser) {
      return targetUser.full_name ? `${targetUser.full_name} (${targetUser.email})` : targetUser.email
    }
    if (targetUserFailed) return `Usuario ${log.target_id}`
    return 'Cargando...'
  }

  return (
    <Modal open title={actionLabel} subtitle={formatDate(log.occurred_at)} onClose={onClose} footer={null}>
      <div className="space-y-6">
        {log.support_session_id ? (
          <Alert
            variant="info"
            title="Acción en modo soporte"
            description="Esta acción la hizo un superadmin dentro de una sesión de soporte."
          />
        ) : null}

        <dl className="space-y-3">
          <DetailRow label="Quién">
            {log.actor_email || '—'} ({actorKindLabel})
          </DetailRow>
          <DetailRow label="Acción">{log.action}</DetailRow>
          <DetailRow label="Tenant">{tenantName || '—'}</DetailRow>
          <DetailRow label="Sobre">
            {renderTarget()}
          </DetailRow>
          {log.support_session_id ? (
            <DetailRow label="Sesión de soporte">{log.support_session_id}</DetailRow>
          ) : null}
        </dl>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Detalles</h3>
          {details.length === 0 ? (
            <p className="text-sm text-slate-500">Esta acción no tiene detalles adicionales.</p>
          ) : (
            <dl className="space-y-3">
              {details.map(([key, value]) => (
                <DetailRow key={key} label={DETAIL_LABELS[key] || key}>
                  {TRANSLATED_FIELDS.includes(key) && VALUE_LABELS[value]
                  ? VALUE_LABELS[value]
                  : formatValue(value)}
                </DetailRow>
              ))}
            </dl>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Datos técnicos</h3>
          <dl className="space-y-3">
            <DetailRow label="IP">{log.ip || '—'}</DetailRow>
            <DetailRow label="Navegador">{log.user_agent || '—'}</DetailRow>
            <DetailRow label="ID del pedido">{log.request_id || '—'}</DetailRow>
          </dl>
        </div>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default AuditLogDetailModal