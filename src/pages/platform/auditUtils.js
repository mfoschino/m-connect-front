export const TARGET_TYPE_LABELS = {
  user: 'Usuario',
  tenant: 'Tenant',
  session: 'Sesión',
  invitation: 'Invitación',
}

const shortId = (id) => (id ? `${id.slice(0, 8)}…` : '—')

// Describe al afectado de un registro con los datos que ya tenemos.
// Devuelve null cuando hace falta pedirle el usuario al backend.
export const describeTargetLocally = (log, tenantNames = {}) => {
  const type = log.target_type
  const id = log.target_id

  if (!type) return '—'

  if (type === 'user') {
    // La persona se afectó a sí misma (por ejemplo, al iniciar sesión)
    if (id && id === log.actor_user_id && log.actor_email) {
      return `${log.actor_email} (la misma persona)`
    }
    // Algunas acciones guardan el email en los detalles (por ejemplo, un login fallido)
    if (log.details?.email) return log.details.email
    // Otro usuario, sin email disponible: hay que pedirlo
    return null
  }

  if (type === 'tenant') return tenantNames[id] || `Tenant ${shortId(id)}`

  if (type === 'session') {
    return log.action === 'auth.logout' ? 'Su propia sesión' : `Sesión ${shortId(id)}`
  }

  if (type === 'invitation') {
    if (log.details?.email) return `Invitación a ${log.details.email}`
    // Al aceptar, quien hace la acción es la persona invitada
    if (log.action === 'invitation.accepted' && log.actor_email) {
      return `Invitación a ${log.actor_email}`
    }
    return `Invitación ${shortId(id)}`
  }

  // Un tipo que todavía no conocemos
  return `${TARGET_TYPE_LABELS[type] || type}: ${shortId(id)}`
}