/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)
const createToastId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())

const buildToastPayload = (input, type, duration) => {
  if (typeof input === 'object' && input !== null) {
    return {
      id: createToastId(),
      type: input.type || 'info',
      title: input.title || '',
      description: input.description || '',
      duration: input.duration ?? 4000,
    }
  }

  return {
    id: createToastId(),
    type: type || 'info',
    title: '',
    description: String(input || ''),
    duration: duration ?? 4000,
  }
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const removeToast = (toastId) => {
    window.clearTimeout(timersRef.current.get(toastId))
    timersRef.current.delete(toastId)
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId))
  }

  const pushToast = (input, type = 'info', duration = 4000) => {
    const nextToast = buildToastPayload(input, type, duration)

    setToasts((prev) => [...prev, nextToast])

    const timeoutId = window.setTimeout(() => {
      removeToast(nextToast.id)
    }, nextToast.duration)

    timersRef.current.set(nextToast.id, timeoutId)
  }

  const showToast = (message, type = 'error', duration = 3000) => {
    pushToast(message, type, duration)
  }

  const value = {
    toasts,
    showToast,
    pushToast,
    removeToast,
  }

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

const useToast = () => {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return context
}

export { ToastProvider, useToast }
