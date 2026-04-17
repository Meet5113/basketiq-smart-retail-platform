import { NavLink } from 'react-router-dom'
import { navSections } from './navigation'
import { getUserModules, getUserRole } from '../../utils/auth'
import BrandMark from '../ui/BrandMark'
import { normalizeUserModules } from '../../utils/userModule'

function Sidebar({ isCollapsed, isMobileOpen, onCloseMobile }) {
  const role = getUserRole()
  const allowedModules = normalizeUserModules(role, getUserModules())

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles.includes(role)) {
          return false
        }

        if (role === 'admin') {
          return true
        }

        return !item.module || allowedModules.includes(item.module)
      }),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-slate-800/90 bg-slate-950 text-slate-100 shadow-[18px_0_60px_rgba(2,6,23,0.42)] transition-all duration-300 print:hidden ${
        isCollapsed ? 'w-[96px]' : 'w-[280px]'
      } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
    >
      <div className={`border-b border-slate-800/90 px-4 py-4 ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <BrandMark size="sidebar" />

          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[0.02em] text-white">BasketIQ</p>
              <p className="truncate text-xs text-slate-400">Smart Retail Platform</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        {visibleSections.map((section) => (
          <section key={section.title} className="mb-5 last:mb-0">
            {!isCollapsed ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{section.title}</p>
            ) : (
              <div className="mb-2 flex justify-center">
                <span className="h-px w-7 bg-slate-800" />
              </div>
            )}

            <nav className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        isCollapsed ? 'justify-center px-2.5' : ''
                      } ${
                        isActive
                          ? 'border-slate-700 bg-slate-900 text-white shadow-inner shadow-slate-950/40'
                          : 'border-transparent text-slate-300 hover:border-slate-800 hover:bg-slate-900/70 hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`absolute inset-y-2 left-0 w-1 rounded-r-full transition ${
                            isActive ? 'bg-indigo-400' : 'bg-transparent group-hover:bg-slate-700'
                          }`}
                        />
                        <Icon size={18} className={`shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-400 group-hover:text-slate-200'}`} />
                        {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </section>
        ))}
      </div>

      <div className="border-t border-slate-800/90 px-4 py-3">
        {!isCollapsed ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
            <p className="mt-1 text-sm text-slate-200">Retail operations, POS, inventory, and analytics.</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
