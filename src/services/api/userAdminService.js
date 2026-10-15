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

const updateUser = (userId, payload) => apiClient.put(`/users/${userId}`, payload)

const deactivateUser = (userId) => apiClient.delete(`/users/${userId}`)

export default {
  listUsers,
  getUser,
  updateUser,
  deactivateUser,
}
