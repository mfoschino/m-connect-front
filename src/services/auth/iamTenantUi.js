export const membershipChoices = (user) => (Array.isArray(user?.memberships)
  ? user.memberships : []).map((membership) => {
  const reason = !membership.tenant_is_active ? 'Organización suspendida'
    : membership.status?.toLowerCase() !== 'active' ? 'Membresía inactiva' : null
  return { ...membership, reason, available: reason === null }
})

export const safePathAfterContextChange = (pathname, role) => {
  if (/^\/executions\/[^/]+\/?$/.test(pathname)) return '/executions'
  if (pathname === '/settings/users' && role?.toLowerCase() !== 'admin') {
    return '/dashboard'
  }
  return null
}
