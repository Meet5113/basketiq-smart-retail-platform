import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, KeyRound, ShieldUser, UserCircle2 } from 'lucide-react'
import api, { getApiErrorMessage, getApiResponseData } from '../services/api'
import { useToast } from '../context/ToastContext'
import { getUserRole, setAuthSession } from '../utils/auth'

const getInitialProfileForm = () => ({
  name: '',
  email: '',
  role: getUserRole() || '',
  avatarUrl: '',
})

const getInitialPasswordForm = () => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

function Profile() {
  const { showToast } = useToast()
  const [profileForm, setProfileForm] = useState(getInitialProfileForm())
  const [passwordForm, setPasswordForm] = useState(getInitialPasswordForm())
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [error, setError] = useState('')

  const loadProfile = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/users/profile')
      const profile = getApiResponseData(response)

      setProfileForm({
        name: profile?.name || '',
        email: profile?.email || '',
        role: profile?.role || getUserRole() || '',
        avatarUrl: profile?.avatarUrl || '',
      })
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load profile')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const initials = useMemo(
    () =>
      String(profileForm.name || 'B')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join(''),
    [profileForm.name],
  )

  const handleProfileSubmit = async (event) => {
    event.preventDefault()
    if (savingProfile) return
    setSavingProfile(true)
    setError('')

    try {
      const response = await api.put('/users/profile', {
        name: profileForm.name,
        email: profileForm.email,
        avatarUrl: profileForm.avatarUrl,
      })
      const updatedProfile = getApiResponseData(response)
      setProfileForm({
        name: updatedProfile?.name || '',
        email: updatedProfile?.email || '',
        role: updatedProfile?.role || profileForm.role,
        avatarUrl: updatedProfile?.avatarUrl || '',
      })
      setAuthSession({
        name: updatedProfile?.name || '',
        avatarUrl: updatedProfile?.avatarUrl || '',
        role: updatedProfile?.role || profileForm.role,
        allowedModules: updatedProfile?.allowedModules,
      })
      showToast('Profile updated successfully', 'success')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to update profile')
      setError(message)
      showToast(message)
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    if (savingPassword) return
    setError('')

    if (passwordForm.newPassword.length < 6) {
      const message = 'New password must be at least 6 characters long.'
      setError(message)
      showToast(message)
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      const message = 'New password and confirm password must match.'
      setError(message)
      showToast(message)
      return
    }

    setSavingPassword(true)

    try {
      await api.put('/users/profile/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm(getInitialPasswordForm())
      showToast('Password updated successfully', 'success')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to update password')
      setError(message)
      showToast(message)
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Loading profile...</p>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800">
              <UserCircle2 size={14} />
              Account Workspace
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Profile</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Review your BasketIQ account details and keep your password updated for daily retail operations.</p>
          </div>

          <div className="flex items-center gap-4 rounded-[24px] border border-slate-200 bg-white/80 px-4 py-3 shadow-sm">
            {profileForm.avatarUrl ? (
              <img src={profileForm.avatarUrl} alt={profileForm.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-base font-semibold text-white">{initials}</div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-950">{profileForm.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{profileForm.role || 'user'}</p>
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleProfileSubmit} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
              <UserCircle2 size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Basic Profile</h2>
              <p className="mt-1 text-sm text-slate-500">Keep your account details accurate for retail operations and user identity.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-start">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Avatar</p>
                <div className="mt-4 flex justify-center">
                  {profileForm.avatarUrl ? (
                    <img src={profileForm.avatarUrl} alt={profileForm.name} className="h-24 w-24 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-900 text-xl font-semibold text-white">{initials}</div>
                  )}
                </div>
              </div>

              <label className="space-y-1.5">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Camera size={14} />
                  Profile avatar URL
                </span>
                <input
                  value={profileForm.avatarUrl}
                  onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))}
                  className="ds-input !rounded-2xl"
                  placeholder="Optional image URL"
                />
              </label>
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                className="ds-input !rounded-2xl"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))}
                  className="ds-input !rounded-2xl"
                  required
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Role</span>
                <input value={profileForm.role} readOnly className="ds-input !rounded-2xl !bg-slate-50 text-slate-500" />
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={savingProfile} className="ds-btn ds-btn-primary">
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        <form onSubmit={handlePasswordSubmit} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
              <KeyRound size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Change Password</h2>
              <p className="mt-1 text-sm text-slate-500">Keep your login secure with a fresh password when needed.</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Current password</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                className="ds-input !rounded-2xl"
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">New password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                className="ds-input !rounded-2xl"
                required
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Confirm new password</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="ds-input !rounded-2xl"
                required
              />
            </label>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-500">
            Use at least 6 characters. Role and module access continue to be managed by BasketIQ admin settings.
          </div>

          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={savingPassword} className="ds-btn ds-btn-primary">
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-700">
            <ShieldUser size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Account Access</h2>
            <p className="mt-1 text-sm text-slate-500">Role remains read-only here so staff management stays with the Users module.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Profile
