export const ALL_MODULES = ['dashboard', 'orders', 'pos', 'products', 'inventory', 'customers', 'users', 'reports']
export const STAFF_MODULE_OPTIONS = ['orders', 'pos', 'products', 'inventory', 'customers']
export const STAFF_CORE_MODULES = ['orders', 'pos', 'customers']

export const MODULE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'orders', label: 'Orders' },
  { value: 'pos', label: 'POS' },
  { value: 'products', label: 'Products' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'customers', label: 'Customers' },
  { value: 'users', label: 'Users' },
  { value: 'reports', label: 'Reports' },
]

export const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'staff', label: 'Staff' },
]

export const normalizeUserModules = (role, allowedModules) => {
  const normalizedRole = String(role || 'staff').toLowerCase()

  if (normalizedRole === 'admin') {
    return [...ALL_MODULES]
  }

  const normalizedModules = Array.isArray(allowedModules)
    ? allowedModules
        .map((moduleName) => String(moduleName || '').trim().toLowerCase())
        .filter((moduleName) => STAFF_MODULE_OPTIONS.includes(moduleName))
    : []

  const resolvedModules = normalizedModules.length > 0 ? normalizedModules : [...STAFF_MODULE_OPTIONS]
  return [...new Set([...STAFF_CORE_MODULES, ...resolvedModules])]
}

export const getModuleLabel = (moduleName) =>
  MODULE_OPTIONS.find((option) => option.value === moduleName)?.label || String(moduleName || '').trim()

export const getRoleBadgeClass = (role) =>
  String(role || '').toLowerCase() === 'admin'
    ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
    : 'bg-slate-100 text-slate-700 ring-slate-200'

export const getStatusBadgeClass = (isActive) =>
  isActive ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-amber-100 text-amber-700 ring-amber-200'

export const getInitialUserForm = (initialData = {}) => ({
  name: initialData?.name || '',
  email: initialData?.email || '',
  password: '',
  role: initialData?.role || 'staff',
  isActive: initialData?.isActive !== false,
  allowedModules: normalizeUserModules(initialData?.role || 'staff', initialData?.allowedModules),
})

export const buildUserPayload = (form, { mode = 'create' } = {}) => {
  const name = String(form?.name || '').trim()
  const email = String(form?.email || '').trim().toLowerCase()
  const password = String(form?.password || '')
  const role = String(form?.role || 'staff').toLowerCase()
  const isActive = form?.isActive !== false
  const allowedModules = normalizeUserModules(role, form?.allowedModules)

  if (!name || !email) {
    throw new Error('Name and email are required.')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error('Enter a valid email address.')
  }

  if (mode === 'create' && password.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }

  const payload = {
    name,
    email,
    role,
    isActive,
    allowedModules,
  }

  if (mode === 'create') {
    payload.password = password
  }

  return payload
}
