// Presentación únicamente: cada endpoint vuelve a autorizar en el backend.
export const getIamPermissions = ({ status, user } = {}) => {
  const role = status === 'authenticated' && user?.tenant_id
    && typeof user.role === 'string'
    ? user.role.toLowerCase()
    : null
  const canView = role === 'viewer' || role === 'operator' || role === 'admin'
  const canManage = role === 'operator' || role === 'admin'
  const canAdminister = role === 'admin'

  return {
    canViewIntegrations: canView,
    canManageIntegrations: canManage,
    canRunIntegrations: canManage,
    canDeleteIntegrations: canAdminister,
    canViewProfiles: canView,
    canManageProfiles: canManage,
    canDeactivateProfiles: canAdminister,
    canViewLookups: canView,
    canManageLookups: canManage,
    canDeleteLookups: canAdminister,
  }
}
