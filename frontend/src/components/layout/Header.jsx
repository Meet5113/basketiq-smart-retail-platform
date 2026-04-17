import { ChevronDown, LogOut, PanelLeft, Plus, Settings2, ShoppingCart, UserCircle2, UserPlus } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import DropdownMenu from './DropdownMenu'
import GlobalSearch from './GlobalSearch'
import NotificationsMenu from './NotificationsMenu'
import { getPageMeta } from './navigation'
import { clearAuthSession, getUserAvatarUrl, getUserName, getUserRole } from '../../utils/auth'
import { useConfirmDialog } from '../../context/ConfirmDialogContext'
import { useToast } from '../../context/ToastContext'

function Header({ isSidebarCollapsed, onToggleSidebar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { confirm } = useConfirmDialog()
  const { showToast } = useToast()
  const role = getUserRole()
  const userName = getUserName() || (role === 'admin' ? 'Admin' : 'Staff')
  const avatarUrl = getUserAvatarUrl()
  const pageMeta = getPageMeta(location.pathname, role)
  const desktopOffsetClass = isSidebarCollapsed ? 'lg:left-[96px]' : 'lg:left-[280px]'
  const initials = (userName || 'A')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

  const handleLogout = async () => {
    const shouldLogout = await confirm({
      title: 'Log out of BasketIQ?',
      description: 'Your current session will end on this device and you will need to sign in again.',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay signed in',
      tone: 'warning',
    })

    if (!shouldLogout) {
      return
    }

    clearAuthSession()
    showToast('Logged out successfully', 'success')
    navigate('/login', { replace: true })
  }

  return (
    <header className={`fixed top-0 right-0 left-0 z-30 border-b border-slate-200/80 bg-white/92 px-4 py-3 backdrop-blur-xl print:hidden ${desktopOffsetClass}`}>
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 xl:grid xl:grid-cols-[minmax(260px,320px)_minmax(420px,1fr)_auto]">
        <div className="order-1 flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            aria-label="Toggle sidebar"
          >
            <PanelLeft size={18} />
          </button>

          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-950">{pageMeta.title}</p>
            <p className="truncate text-sm text-slate-500">{pageMeta.subtitle}</p>
          </div>
        </div>

        <div className="order-3 basis-full xl:order-2 xl:basis-auto">
          <GlobalSearch />
        </div>

        <div className="order-2 ml-auto flex items-center gap-2 xl:order-3">
          <DropdownMenu
            align="right"
            panelClassName="w-[220px]"
            trigger={({ isOpen, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-medium shadow-sm transition ${
                  isOpen
                    ? 'border-slate-300 bg-slate-100 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Quick Actions</span>
                <ChevronDown size={16} className={`${isOpen ? 'rotate-180' : ''} transition-transform`} />
              </button>
            )}
          >
            {({ close }) => (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate('/products/new')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus size={16} className="text-indigo-600" />
                  Add Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate('/pos')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <ShoppingCart size={16} className="text-emerald-600" />
                  New Sale
                </button>
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate('/customers')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <UserPlus size={16} className="text-sky-600" />
                  Add Customer
                </button>
              </div>
            )}
          </DropdownMenu>

          <NotificationsMenu />

          <DropdownMenu
            align="right"
            panelClassName="w-[220px]"
            trigger={({ isOpen, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className={`inline-flex h-11 items-center gap-3 rounded-2xl border px-3 pr-4 text-left shadow-sm transition ${
                  isOpen
                    ? 'border-slate-300 bg-slate-100'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-semibold text-white">{initials}</div>
                )}
                <div className="hidden min-w-0 sm:block">
                  <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                  <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-500">{role || 'user'}</p>
                </div>
                <ChevronDown size={16} className={`${isOpen ? 'rotate-180' : ''} hidden text-slate-500 transition-transform sm:block`} />
              </button>
            )}
          >
            {({ close }) => (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    close()
                    navigate('/profile')
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <UserCircle2 size={16} className="text-slate-500" />
                  Profile
                </button>
                {role === 'admin' ? (
                  <button
                    type="button"
                    onClick={() => {
                      close()
                      navigate('/settings')
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Settings2 size={16} className="text-slate-500" />
                    Settings
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    close()
                    handleLogout()
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export default Header
