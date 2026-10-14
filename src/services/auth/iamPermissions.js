// Presentación únicamente: cada endpoint vuelve a autorizar en el backend.
export const getIamPermissions = ({ status, user } = {}) => {
  const role = status === 'authenticated' && user?.tenant_id
    && typeof user.role === 'string'
    ? user.role.toLowerCase()
    : null
  const canView = role === 'viewer' || role === 'operator' || role === 'admin'
  const canManage = role === 'operator' || role === 'admin'
  const canAdminister = role === 'admin'
  const support = user?.support_session
  const validSupport = Boolean(canView && support && support.tenant_id === user.tenant_id)
  const supportReadOnly = validSupport && support.access_level === 'read_only'
  const supportFull = validSupport && support.access_level === 'full'

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
    canViewExecutions: canView,
    canViewSettings: canView,
    canViewUserAdmin: canAdminister,
    canViewFinnegansCredentials: canAdminister || supportReadOnly,
    canManageFinnegansCredentials: canAdminister && (!support || supportFull),
  }
}
