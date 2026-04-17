import { useMemo, useState } from 'react'
import { ShieldUser, UserCog, X } from 'lucide-react'
import {
  buildUserPayload,
  getInitialUserForm,
  getModuleLabel,
  MODULE_OPTIONS,
  normalizeUserModules,
  ROLE_OPTIONS,
  STAFF_CORE_MODULES,
  STAFF_MODULE_OPTIONS,
} from '../../utils/userModule'

function UserFormDrawer({
  open,
  mode = 'create',
  initialData,
  submitting,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => getInitialUserForm(initialData))
  const [error, setError] = useState('')

  const isEditMode = mode === 'edit'
  const heading = isEditMode ? 'Edit Staff Access' : 'Add User'
  const supportingText = isEditMode
    ? 'Update profile, role, active status, and simple retail module access.'
    : 'Create a retail staff or admin account for BasketIQ operations.'

  const visibleModules = useMemo(
    () =>
      MODULE_OPTIONS.filter((option) =>
        form.role === 'admin' ? true : STAFF_MODULE_OPTIONS.includes(option.value),
      ),
    [form.role],
  )

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }

      if (field === 'role') {
        next.allowedModules = normalizeUserModules(value, current.allowedModules)
        if (value === 'admin') {
          next.isActive = true
        }
      }

      return next
    })
  }

  const toggleModule = (moduleName) => {
    setForm((current) => {
      const currentModules = normalizeUserModules(current.role, current.allowedModules)
      const isSelected = currentModules.includes(moduleName)

      return {
        ...current,
        allowedModules: isSelected
          ? currentModules.filter((entry) => entry !== moduleName)
          : [...currentModules, moduleName],
      }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    let payload

    try {
      payload = buildUserPayload(form, { mode })
      setError('')
    } catch (validationError) {
      setError(validationError?.message || 'Please review the user details.')
      return
    }

    const wasSuccessful = await onSubmit(payload)
    if (wasSuccessful !== false) {
      setError('')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-slate-950/45 backdrop-blur-[2px]">
      <button type="button" aria-label="Close user drawer" className="flex-1 cursor-default" onClick={onClose} />

      <aside className="h-full w-full max-w-[520px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                <UserCog size={14} />
                Staff Management
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">{heading}</h2>
              <p className="mt-1 text-sm text-slate-500">{supportingText}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5">
          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

          <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                <ShieldUser size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">User Profile</h3>
                <p className="mt-1 text-sm text-slate-500">Basic identity and retail role for the account.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Full name</span>
                <input
                  className="ds-input !rounded-2xl !bg-white"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="e.g. Rohan Verma"
                  required
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  className="ds-input !rounded-2xl !bg-white"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  placeholder="staff@basketiq.com"
                  required
                />
              </label>

              {!isEditMode ? (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Password</span>
                  <input
                    type="password"
                    className="ds-input !rounded-2xl !bg-white"
                    value={form.password}
                    onChange={(event) => updateField('password', event.target.value)}
                    placeholder="Minimum 6 characters"
                    required
                  />
                </label>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700">Role</span>
                  <select
                    className="ds-select !w-full !rounded-2xl !bg-white"
                    value={form.role}
                    onChange={(event) => updateField('role', event.target.value)}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.isActive !== false}
                    onChange={(event) => updateField('isActive', event.target.checked)}
                    disabled={form.role === 'admin'}
                  />
                  User is active
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                <UserCog size={18} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Module Access</h3>
                <p className="mt-1 text-sm text-slate-500">Keep module access simple and aligned to daily retail operations.</p>
              </div>
            </div>

            {form.role === 'admin' ? (
              <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                <p className="text-sm font-medium text-indigo-800">Admin users have full access to all BasketIQ modules.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MODULE_OPTIONS.map((moduleOption) => (
                    <span
                      key={moduleOption.value}
                      className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700"
                    >
                      {moduleOption.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {visibleModules.map((moduleOption) => {
                  const isSelected = form.allowedModules.includes(moduleOption.value)
                  const isRequiredModule = STAFF_CORE_MODULES.includes(moduleOption.value)

                  return (
                    <label
                      key={moduleOption.value}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleModule(moduleOption.value)}
                        disabled={isRequiredModule}
                      />
                      <span className="font-medium">
                        {getModuleLabel(moduleOption.value)}
                        {isRequiredModule ? ' (Core)' : ''}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="ds-btn ds-btn-primary">
              {submitting ? (isEditMode ? 'Saving...' : 'Creating...') : isEditMode ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

export default UserFormDrawer
