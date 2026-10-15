import apiClient from './client'

const listNotifications = ({ limit = 10 } = {}) =>
  apiClient.get('/notifications', {
    params: { limit },
  })

const getUnreadCount = () => apiClient.get('/notifications/unread-count')

const markAsRead = (notificationId) => apiClient.patch(`/notifications/${notificationId}/read`)

export default {
  listNotifications,
  getUnreadCount,
  markAsRead,
}
