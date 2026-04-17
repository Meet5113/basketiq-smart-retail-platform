import axios from 'axios'
import { clearAuthSession, getToken } from '../utils/auth'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
let unauthorizedNotified = false

const normalizeErrorDetails = (details) => {
  if (Array.isArray(details)) {
    return details.map((item) => String(item || '').trim()).filter(Boolean)
  }

  if (details && typeof details === 'object') {
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${String(value || '').trim()}`.trim())
      .filter(Boolean)
  }

  if (typeof details === 'string') {
    const normalized = details.trim()
    return normalized ? [normalized] : []
  }

  return []
}

const unwrapApiPayload = (payload) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'success' in payload && 'data' in payload) {
    return payload.data
  }

  return payload ?? null
}

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => unwrapApiPayload(response?.data),
  (error) => {
    const status = error?.response?.status
    const requestUrl = String(error?.config?.url || '')
    const requestMethod = String(error?.config?.method || 'GET').toUpperCase()
    const details = normalizeErrorDetails(error?.response?.data?.error?.details)
    const baseMessage = error?.response?.data?.message || error?.message || 'Something went wrong'
    const shouldAppendDetails =
      details.length > 0 &&
      ['Validation failed.', 'Duplicate value conflict.', 'Something went wrong'].includes(baseMessage)
    const apiMessage =
      shouldAppendDetails && !details.includes(baseMessage)
        ? `${baseMessage} ${details.join(' ')}`
        : baseMessage

    error.apiMessage = apiMessage
    error.apiDetails = details

    if (status === 401 && !requestUrl.includes('/auth/login')) {
      clearAuthSession()

      if (typeof window !== 'undefined' && !unauthorizedNotified) {
        unauthorizedNotified = true
        window.dispatchEvent(new CustomEvent('app:unauthorized'))
        window.setTimeout(() => {
          unauthorizedNotified = false
        }, 0)
      }
    }

    if (typeof console !== 'undefined') {
      console.error('API request failed', {
        method: requestMethod,
        status,
        url: requestUrl,
        message: apiMessage,
      })
    }

    return Promise.reject(error)
  },
)

export const getApiErrorMessage = (error, fallbackMessage = 'Something went wrong') =>
  error?.apiMessage || error?.response?.data?.message || error?.message || fallbackMessage

export const getApiResponseData = (response) => response ?? null

export const getApiArrayData = (response) => {
  return Array.isArray(response) ? response : []
}

export default api
