import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, ClipboardList, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import DropdownMenu from './DropdownMenu'
import api, { getApiArrayData, getApiErrorMessage } from '../../services/api'

const POLL_INTERVAL_MS = 60000

const isToday = (value) => {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  const now = new Date()

  return (
    parsed.getDate() === now.getDate() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getFullYear() === now.getFullYear()
  )
}

const formatTimestamp = (value) => {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Just now'
  }

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function NotificationsMenu() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
    }

    try {
      const response = await api.get('/notifications')
      setNotifications(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      setError(getApiErrorMessage(apiError, 'Notifications are unavailable right now.'))
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const hydrateNotifications = async () => {
      if (!isActive) return
      await loadNotifications()
    }

    void hydrateNotifications()

    const intervalId = window.setInterval(() => {
      void loadNotifications({ silent: true })
    }, POLL_INTERVAL_MS)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
    }
  }, [loadNotifications])

  const unreadCount = notifications.filter((item) => !item.isRead).length
  const groupedNotifications = useMemo(
    () => ({
      today: notifications.filter((item) => isToday(item.timestamp)),
      earlier: notifications.filter((item) => !isToday(item.timestamp)),
    }),
    [notifications],
  )

  const markAsRead = useCallback(async (notificationId) => {
    setNotifications((current) =>
      current.map((item) => (item._id === notificationId ? { ...item, isRead: true } : item)),
    )

    try {
      await api.put(`/notifications/${notificationId}/read`)
    } catch {
      void loadNotifications({ silent: true })
    }
  }, [loadNotifications])

  const markAllAsRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))

    try {
      const response = await api.put('/notifications/read-all')
      setNotifications(getApiArrayData(response))
    } catch {
      void loadNotifications({ silent: true })
    }
  }, [loadNotifications])

  const renderNotificationGroup = (label, items, close) => {
    if (items.length === 0) {
      return null
    }

    return (
      <div>
        <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <div className="space-y-2 px-2">
          {items.map((item) => {
            const Icon = item.type === 'order' ? ClipboardList : TriangleAlert

            return (
              <button
                key={item._id}
                type="button"
                onClick={() => {
                  void markAsRead(item._id)
                  close()
                  navigate(item.href || '/')
                }}
                className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  item.isRead
                    ? 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                    : 'border-indigo-100 bg-indigo-50/70 hover:border-indigo-200 hover:bg-indigo-50'
                }`}
              >
                <div
                  className={`mt-0.5 rounded-xl p-2 ${
                    item.type === 'order' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                    {!item.isRead ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" /> : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                  <p className="mt-2 text-[11px] font-medium text-slate-400">{formatTimestamp(item.timestamp)}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu
      align="right"
      panelClassName="w-[360px] p-0"
      trigger={({ isOpen, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={`relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
            isOpen
              ? 'border-slate-300 bg-slate-100 text-slate-900'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
          }`}
          aria-label="Open notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 ? (
            <span className="absolute top-2 right-2 min-w-[18px] rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="text-xs text-slate-500">Low stock and recent billing activity across BasketIQ.</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Unread</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{unreadCount}</p>
              </div>
            </div>

            {notifications.length > 0 ? (
              <button
                type="button"
                onClick={() => void markAllAsRead()}
                className="mt-3 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          {loading ? <p className="px-4 py-6 text-sm text-slate-500">Loading notifications...</p> : null}

          {!loading && error ? (
            <p className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-amber-700">{error}</p>
          ) : null}

          {!loading && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-slate-900">No notifications yet</p>
              <p className="mt-2 text-sm text-slate-500">Low stock and order activity will appear here as the store runs daily operations.</p>
            </div>
          ) : null}

          {!loading && notifications.length > 0 ? (
            <div className="max-h-[420px] space-y-4 overflow-y-auto py-3">
              {renderNotificationGroup('Today', groupedNotifications.today, close)}
              {renderNotificationGroup('Earlier', groupedNotifications.earlier, close)}
            </div>
          ) : null}
        </div>
      )}
    </DropdownMenu>
  )
}

export default NotificationsMenu
