import apiClient from './client'

// Tenants
const listTenants = (params) => apiClient.get('/platform/tenants', { params })
const getTenant = (tenantId) => apiClient.get(`/platform/tenants/${tenantId}`)
const createTenant = (payload) => apiClient.post('/platform/tenants', payload)
const updateTenant = (tenantId, payload) => apiClient.patch(`/platform/tenants/${tenantId}`, payload)

// Miembros de un tenant
const listTenantMembers = (tenantId, params) =>
  apiClient.get(`/platform/tenants/${tenantId}/members`, { params })
const updateTenantMember = (tenantId, userId, payload) =>
  apiClient.patch(`/platform/tenants/${tenantId}/members/${userId}`, payload)

// Invitaciones de un tenant
const listTenantInvitations = (tenantId) =>
  apiClient.get(`/platform/tenants/${tenantId}/invitations`)
const createTenantInvitation = (tenantId, payload) =>
  apiClient.post(`/platform/tenants/${tenantId}/invitations`, payload)
const resendTenantInvitation = (tenantId, invitationId) =>
  apiClient.post(`/platform/tenants/${tenantId}/invitations/${invitationId}/resend`)
const cancelTenantInvitation = (tenantId, invitationId) =>
  apiClient.delete(`/platform/tenants/${tenantId}/invitations/${invitationId}`)

// Usuarios globales
const listUsers = (params) => apiClient.get('/platform/users', { params })
const getUser = (userId) => apiClient.get(`/platform/users/${userId}`)
const updateUser = (userId, payload) => apiClient.patch(`/platform/users/${userId}`, payload)
const revokeUserSessions = (userId) => apiClient.post(`/platform/users/${userId}/revoke-sessions`)
const forcePasswordReset = (userId) => apiClient.post(`/platform/users/${userId}/force-password-reset`)
const unlockUser = (userId) => apiClient.post(`/platform/users/${userId}/unlock`)


export default {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  listTenantMembers,
  updateTenantMember,
  listTenantInvitations,
  createTenantInvitation,
  resendTenantInvitation,
  cancelTenantInvitation,
  listUsers,
  getUser,
  updateUser,
  revokeUserSessions,
  forcePasswordReset,
  unlockUser,
}