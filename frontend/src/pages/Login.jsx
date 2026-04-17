import { useEffect, useState } from 'react'
import { LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BrandMark from '../components/ui/BrandMark'
import api, { getApiErrorMessage } from '../services/api'
import { clearAuthSession, getToken, getUserRole, setAuthSession } from '../utils/auth'
import { useToast } from '../context/ToastContext'

function Login() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const token = getToken()
    const role = getUserRole()

    if (token && role) {
      navigate(role === 'admin' ? '/' : '/pos', { replace: true })
      return
    }

    if (token && !role) {
      clearAuthSession()
    }
  }, [navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const user = await api.post('/auth/login', { email, password })
      setAuthSession({
        token: user?.token,
        role: user?.role,
        name: user?.name,
        avatarUrl: user?.avatarUrl,
        allowedModules: user?.allowedModules,
      })
      showToast('Login successful', 'success')
      navigate(user?.role === 'admin' ? '/' : '/pos', { replace: true })
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Invalid credentials')
      setError(message)
      showToast(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-100 px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fafc_42%,#eef2f7_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-slate-200/55 to-transparent" />

      <div className="relative w-full max-w-md">
        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-7 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)] sm:px-8 sm:py-8">
          <div className="mb-8 text-center">
            <BrandMark className="mx-auto" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">BasketIQ</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Admin Login</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Smart Retail Platform access for billing, inventory, products, and store operations.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Access</p>
              <p className="mt-1 text-sm font-medium text-slate-800">Admin Panel</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Platform</p>
              <p className="mt-1 text-sm font-medium text-slate-800">Retail Workspace</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label htmlFor="email" className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email Address</span>
              <div className="relative">
                <Mail size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Enter your email"
                  className="ds-input h-12 rounded-xl border-slate-300 pl-11 text-[15px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                />
              </div>
            </label>

            <label htmlFor="password" className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
              <div className="relative">
                <LockKeyhole size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="ds-input h-12 rounded-xl border-slate-300 pl-11 text-[15px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                />
              </div>
            </label>

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.55)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck size={18} />
              {isSubmitting ? 'Logging in...' : 'Login to Dashboard'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-4 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">Smart Retail Platform</p>
            <p className="mt-1 text-sm text-slate-500">Secure access for daily store administration.</p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default Login
