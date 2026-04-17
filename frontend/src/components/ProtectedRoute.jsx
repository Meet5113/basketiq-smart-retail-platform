import { Navigate } from 'react-router-dom'
import { clearAuthSession, getToken, getUserModules, getUserRole } from '../utils/auth'
import { normalizeUserModules } from '../utils/userModule'

function ProtectedRoute({ allowedRoles, requiredModule, children }) {
  const token = getToken()
  const role = getUserRole()
  const allowedModules = normalizeUserModules(role, getUserModules())

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!role) {
    clearAuthSession()
    return <Navigate to="/login" replace />
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    const fallbackPath = role === 'staff' ? '/pos' : '/'
    return <Navigate to={fallbackPath} replace />
  }

  if (requiredModule && role !== 'admin' && !allowedModules.includes(requiredModule)) {
    return <Navigate to="/pos" replace />
  }

  return children
}

export default ProtectedRoute
