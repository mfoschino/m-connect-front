export const routeDecision = ({ status, user }, allowedRoles = []) => {
  if (status === 'bootstrapping') return 'loading'
  if (status === 'unsupported' || status === 'unavailable'
    || status === 'recovery_required') return 'error'
  if (status !== 'authenticated' || !user) return 'login'
  if (!user.tenant_id || !user.role) return 'no_tenant'
  if (allowedRoles.length && !allowedRoles.includes(user.role.toLowerCase())) return 'forbidden'
  return 'allow'
}
