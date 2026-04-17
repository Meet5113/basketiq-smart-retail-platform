import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pencil, Search, ShieldUser, Trash2, UserCog } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useConfirmDialog } from '../context/ConfirmDialogContext'
import { useToast } from '../context/ToastContext'
import UserFormDrawer from '../components/users/UserFormDrawer'
import api, { getApiArrayData, getApiErrorMessage, getApiResponseData } from '../services/api'
import { getToken } from '../utils/auth'
import {
  getModuleLabel,
  getRoleBadgeClass,
  getStatusBadgeClass,
  ROLE_OPTIONS,
} from '../utils/userModule'

const formatDate = (value) => {
  if (!value) return 'N/A'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'

  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function Users() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()
  const [users, setUsers] = useState([])
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionUserId, setActionUserId] = useState('')
  const [drawerMode, setDrawerMode] = useState('create')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [error, setError] = useState('')

  const handleForbidden = useCallback(
    (statusCode) => {
      if (statusCode === 403) {
        navigate('/pos', { replace: true })
        return true
      }

      return false
    },
    [navigate],
  )

  const fetchUsers = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/users')
      setUsers(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      if (handleForbidden(apiError?.response?.status)) {
        return
      }

      const message = getApiErrorMessage(apiError, 'Failed to load users')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [handleForbidden, showToast])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    void fetchUsers()
  }, [fetchUsers, navigate])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    return getApiArrayData(users).filter((user) => {
      const userName = String(user.name || '').toLowerCase()
      const userEmail = String(user.email || '').toLowerCase()
      const userRole = String(user.role || '').toLowerCase()
      const matchesSearch =
        !normalizedSearch || userName.includes(normalizedSearch) || userEmail.includes(normalizedSearch)
      const matchesRole = !roleFilter || userRole === roleFilter

      return matchesSearch && matchesRole
    })
  }, [roleFilter, searchText, users])

  const openCreateDrawer = () => {
    setDrawerMode('create')
    setSelectedUser(null)
    setDrawerOpen(true)
    setError('')
  }

  const openEditDrawer = (user) => {
    setDrawerMode('edit')
    setSelectedUser(user)
    setDrawerOpen(true)
    setError('')
  }

  const closeDrawer = () => {
    if (submitting) return
    setDrawerOpen(false)
    setSelectedUser(null)
  }

  const handleCreateUser = async (payload) => {
    setSubmitting(true)
    setError('')

    try {
      const response = await api.post('/users', payload)
      const createdUser = getApiResponseData(response)
      setUsers((current) => [createdUser, ...current])
      setDrawerOpen(false)
      setSelectedUser(null)
      showToast('User created successfully', 'success')
      return true
    } catch (apiError) {
      if (handleForbidden(apiError?.response?.status)) {
        return false
      }

      const message = getApiErrorMessage(apiError, 'Failed to create user')
      setError(message)
      showToast(message)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateUser = async (payload) => {
    if (!selectedUser?._id) return false

    setSubmitting(true)
    setError('')

    try {
      const response = await api.put(`/users/${selectedUser._id}`, payload)
      const updatedUser = getApiResponseData(response)
      setUsers((current) => current.map((user) => (user._id === updatedUser._id ? updatedUser : user)))
      setDrawerOpen(false)
      setSelectedUser(null)
      showToast('User updated successfully', 'success')
      return true
    } catch (apiError) {
      if (handleForbidden(apiError?.response?.status)) {
        return false
      }

      const message = getApiErrorMessage(apiError, 'Failed to update user')
      setError(message)
      showToast(message)
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = useCallback(
    async (user) => {
      const nextActive = user.isActive === false
      const shouldContinue = await confirm({
        title: `${nextActive ? 'Activate' : 'Deactivate'} ${user.name}?`,
        description: nextActive
          ? 'This user will be able to sign in and resume their retail workspaces.'
          : 'This user will lose access to sign in until reactivated by an admin.',
        confirmLabel: nextActive ? 'Activate user' : 'Deactivate user',
        cancelLabel: 'Keep current status',
        tone: nextActive ? 'info' : 'warning',
      })

      if (!shouldContinue) {
        return
      }

      setActionUserId(user._id)
      setError('')

      try {
        const response = await api.put(`/users/${user._id}`, {
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: nextActive,
          allowedModules: user.allowedModules,
        })
        const updatedUser = getApiResponseData(response)
        setUsers((current) => current.map((entry) => (entry._id === updatedUser._id ? updatedUser : entry)))
        showToast(`User ${nextActive ? 'activated' : 'deactivated'} successfully`, 'success')
      } catch (apiError) {
        if (handleForbidden(apiError?.response?.status)) {
          return
        }

        const message = getApiErrorMessage(apiError, 'Failed to update user status')
        setError(message)
        showToast(message)
      } finally {
        setActionUserId('')
      }
    },
    [confirm, handleForbidden, showToast],
  )

  const handleDeleteUser = useCallback(
    async (user) => {
      const shouldDelete = await confirm({
        title: `Delete ${user.name}?`,
        description: 'This account will be removed and access will be revoked from BasketIQ immediately.',
        confirmLabel: 'Delete user',
        cancelLabel: 'Keep user',
        tone: 'danger',
      })

      if (!shouldDelete) {
        return
      }

      setActionUserId(user._id)
      setError('')

      try {
        await api.delete(`/users/${user._id}`)
        setUsers((current) => current.filter((entry) => entry._id !== user._id))
        showToast('User deleted successfully', 'success')
      } catch (apiError) {
        if (handleForbidden(apiError?.response?.status)) {
          return
        }

        const message = getApiErrorMessage(apiError, 'Failed to delete user')
        setError(message)
        showToast(message)
      } finally {
        setActionUserId('')
      }
    },
    [confirm, handleForbidden, showToast],
  )

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <ShieldUser size={14} />
              Retail Staff Management
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Users</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Manage admin and staff accounts for POS, products, inventory, customers, and reporting workflows in BasketIQ.
            </p>
          </div>

          <button type="button" onClick={openCreateDrawer} className="ds-btn ds-btn-primary print:hidden">
            <UserCog size={16} />
            Add User
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Users Table</h2>
              <p className="mt-1 text-sm text-slate-500">Search and review account access across BasketIQ operations.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search by name or email"
                className="ds-input !w-full !py-2.5 !pr-3 !pl-9"
              />
            </label>

            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="ds-select !w-full">
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5">
            {loading ? (
              <TableSkeleton columns={7} rows={8} />
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-12 text-center">
                <p className="text-base font-semibold text-slate-900">No users found</p>
                <p className="mt-2 text-sm text-slate-500">Create a staff or admin account to start managing retail workspace access.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-[24px] border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-3 py-3 font-semibold">Email</th>
                      <th className="px-3 py-3 font-semibold">Role</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Assigned Modules</th>
                      <th className="px-3 py-3 font-semibold">Created Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                        <td className="px-3 py-3 text-slate-700">{user.email}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase ring-1 ${getRoleBadgeClass(user.role)}`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(user.isActive !== false)}`}
                          >
                            {user.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(user.allowedModules) && user.allowedModules.length > 0 ? (
                              user.allowedModules.map((moduleName) => (
                                <span
                                  key={`${user._id}-${moduleName}`}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                                >
                                  {getModuleLabel(moduleName)}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">No modules assigned</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditDrawer(user)}
                              className="ds-btn ds-btn-secondary !px-3 !py-2 !text-xs"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(user)}
                              disabled={actionUserId === user._id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {user.isActive !== false ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={actionUserId === user._id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
      </section>

      <UserFormDrawer
        key={`${drawerMode}-${selectedUser?._id || 'new'}-${drawerOpen ? 'open' : 'closed'}`}
        open={drawerOpen}
        mode={drawerMode}
        initialData={selectedUser}
        submitting={submitting}
        onClose={closeDrawer}
        onSubmit={drawerMode === 'edit' ? handleUpdateUser : handleCreateUser}
      />
    </div>
  )
}

export default Users
