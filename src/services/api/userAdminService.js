import apiClient from './client'

export const USER_ROLES = ['admin', 'operator', 'viewer']

export const ROLE_ALIASES = {
  admin: 'admin',
  operador: 'operator',
  operator: 'operator',
  viewer: 'viewer',
}

export const normalizeRole = (role) => ROLE_ALIASES[String(role || '').toLowerCase()] || ''

const listUsers = ({ skip = 0, limit = 50 } = {}) =>
  apiClient.get('/users/', {
    params: { skip, limit },
  })

const getUser = (userId) => apiClient.get(`/users/${userId}`)

const createUser = (payload) => apiClient.post('/users/', payload)

const updateUser = (userId, payload) => apiClient.patch(`/users/${userId}`, payload)

const deactivateUser = (userId) => apiClient.delete(`/users/${userId}`)

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deactivateUser,
}
