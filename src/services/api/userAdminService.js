import apiClient from './client'

export const USER_ROLES = ['admin', 'operator', 'viewer']

export const ROLE_ALIASES = {
  admin: 'admin',
  operador: 'operator',
  operator: 'operator',
  viewer: 'viewer',
}

export const normalizeRole = (role) => ROLE_ALIASES[String(role || '').toLowerCase()] || ''

const listUsers = ({ skip = 0, limit = 50, include_disabled = false } = {}) =>
  apiClient.get('/tenant/members', {
    params: { skip, limit, include_disabled },
  })

const getUser = (userId) => apiClient.get(`/tenant/members/${userId}`)

const updateUser = (userId, { full_name, role, is_active } = {}) =>
  apiClient.patch(`/tenant/members/${userId}`, {
    ...(full_name !== undefined ? { full_name } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(is_active !== undefined ? { is_active } : {}),
  }, { _iamSkipAuthRetry: true })

const deactivateUser = (userId) =>
  apiClient.delete(`/tenant/members/${userId}`, { _iamSkipAuthRetry: true })

const reactivateUser = (userId) => updateUser(userId, { is_active: true })

export default {
  listUsers,
  getUser,
  updateUser,
  deactivateUser,
  reactivateUser,
}
