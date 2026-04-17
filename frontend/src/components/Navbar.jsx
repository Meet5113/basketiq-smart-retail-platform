import { Link, NavLink, useNavigate } from 'react-router-dom'
import { clearAuthSession, getUserRole } from '../utils/auth'
import { useToast } from '../context/ToastContext'

function Navbar() {
  const navigate = useNavigate()
  const role = getUserRole()
  const { showToast } = useToast()

  const navItems =
    role === 'admin'
      ? [
          { path: '/', label: 'Dashboard' },
          { path: '/products', label: 'Products' },
          { path: '/pos', label: 'POS' },
          { path: '/reports', label: 'Reports' },
        ]
      : [
          { path: '/products', label: 'Products' },
          { path: '/pos', label: 'POS' },
        ]

  const handleLogout = () => {
    clearAuthSession()
    showToast('Logged out successfully', 'success')
    navigate('/login', { replace: true })
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link to={role === 'admin' ? '/' : '/pos'} className="text-lg font-bold text-slate-900">
          BasketIQ
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
