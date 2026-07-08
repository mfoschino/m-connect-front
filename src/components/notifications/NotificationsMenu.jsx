import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Bell, Check, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import notificationService from '../../services/api/notificationService'

const TYPE_CONFIG = {
  critical_error: {
    label: 'Error critico',
    icon: AlertCircle,
    className: 'border-red-100 bg-red-50 text-red-700',
  },
  execution_completed: {
    label: 'Ejecucion completada',
    icon: CheckCircle2,
    className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  },
  alert: {
    label: 'Alerta',
    icon: AlertTriangle,
    className: 'border-amber-100 bg-amber-50 text-amber-700',
  },
}

const normalizeNotification = (notification) => ({
  id: notification.id,
  tenantId: notification.tenantId ?? notification.tenant_id ?? notification.organizationId ?? notification.organization_id ?? notification.workspaceId ?? notification.workspace_id,
  userId: notification.userId ?? notification.user_id,
  type: notification.type || 'alert',
  severity: notification.severity || 'info',
  title: notification.title || 'Notificacion',
  message: notification.message || notification.description || '',
  readAt: notification.readAt ?? notification.read_at ?? null,
  createdAt: notification.createdAt ?? notification.created_at ?? null,
  relatedEntityType: notification.relatedEntityType ?? notification.related_entity_type,
  relatedEntityId: notification.relatedEntityId ?? notification.related_entity_id,
})

const getListFromResponse = (data) => {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.notifications)) return data.notifications
  return []
}

const getUnreadCountFromResponse = (data) => {
  if (typeof data?.count === 'number') return data.count
  if (typeof data?.unread === 'number') return data.unread
  if (typeof data?.unread_count === 'number') return data.unread_count
  return null
}

const formatDate = (value) => {
  if (!value) return 'Sin fecha'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'

  return date.toLocaleString()
}

const NotificationsMenu = () => {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [markingId, setMarkingId] = useState(null)
  const menuRef = useRef(null)

  const currentTenantId = user?.tenant_id ?? user?.tenantId ?? user?.organization_id ?? user?.organizationId ?? user?.workspace_id ?? user?.workspaceId

  const visibleNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (!currentTenantId || !notification.tenantId) return true
      return String(notification.tenantId) === String(currentTenantId)
    })
  }, [currentTenantId, notifications])

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [listResult, countResult] = await Promise.allSettled([
        notificationService.listNotifications({ limit: 10 }),
        notificationService.getUnreadCount(),
      ])

      if (listResult.status === 'rejected') {
        throw listResult.reason
      }

      const nextNotifications = getListFromResponse(listResult.value?.data).map(normalizeNotification)
      setNotifications(nextNotifications)

      const nextVisible = nextNotifications.filter((notification) => {
        if (!currentTenantId || !notification.tenantId) return true
        return String(notification.tenantId) === String(currentTenantId)
      })

      const apiUnreadCount = countResult.status === 'fulfilled'
        ? getUnreadCountFromResponse(countResult.value?.data)
        : null

      setUnreadCount(apiUnreadCount ?? nextVisible.filter((notification) => !notification.readAt).length)
    } catch (err) {
      console.error('Failed to load notifications', err)
      setError('No se pudieron cargar las notificaciones.')
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [currentTenantId])

  useEffect(() => {
    const timeoutId = window.setTimeout(loadNotifications, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadNotifications])

  useEffect(() => {
    if (!isOpen) return undefined

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleMarkAsRead = async (notification) => {
    setActionError(null)
    setMarkingId(notification.id)

    try {
      const response = await notificationService.markAsRead(notification.id)
      const readAt = response?.data?.readAt ?? response?.data?.read_at ?? new Date().toISOString()

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, readAt }
            : item,
        ),
      )
      setUnreadCount((current) => Math.max(current - 1, 0))
    } catch (err) {
      console.error('Failed to mark notification as read', err)
      setActionError('No se pudo marcar como leida. Intenta de nuevo.')
    } finally {
      setMarkingId(null)
    }
  }

  const badgeCount = Math.min(unreadCount, 99)

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        aria-label="Abrir notificaciones"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-none text-white">
            {unreadCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-30 mt-3 w-[min(92vw,26rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notificaciones</p>
              <p className="mt-1 text-xs text-slate-500">
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Sin pendientes'}
              </p>
            </div>
            <button
              type="button"
              onClick={loadNotifications}
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              Actualizar
            </button>
          </div>

          <div className="max-h-[28rem] overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-3 px-4 py-6 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Cargando notificaciones...
              </div>
            ) : error ? (
              <div className="px-4 py-6 text-sm">
                <p className="font-medium text-red-600">{error}</p>
                <p className="mt-2 text-slate-500">El endpoint de notificaciones todavia no esta disponible o rechazo la solicitud.</p>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No hay notificaciones recientes.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleNotifications.map((notification) => {
                  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.alert
                  const TypeIcon = config.icon
                  const isUnread = !notification.readAt

                  return (
                    <li key={notification.id} className={`px-4 py-4 ${isUnread ? 'bg-slate-50/80' : 'bg-white'}`}>
                      <div className="flex gap-3">
                        <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${config.className}`}>
                          <TypeIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.className}`}>
                              {config.label}
                            </span>
                            <span className="text-xs text-slate-500">{formatDate(notification.createdAt)}</span>
                            {isUnread ? (
                              <span className="h-2 w-2 rounded-full bg-sky-500" aria-label="No leida" />
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{notification.title}</p>
                          {notification.message ? (
                            <p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p>
                          ) : null}
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs text-slate-500">{isUnread ? 'No leida' : 'Leida'}</span>
                            {isUnread ? (
                              <button
                                type="button"
                                onClick={() => handleMarkAsRead(notification)}
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={markingId === notification.id}
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                {markingId === notification.id ? 'Marcando...' : 'Marcar leida'}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {actionError ? (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {actionError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default NotificationsMenu
