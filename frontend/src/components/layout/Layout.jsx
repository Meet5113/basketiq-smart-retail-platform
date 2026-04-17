import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const SIDEBAR_STORAGE_KEY = 'basketiq.sidebar.collapsed'

function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  })
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen((prev) => !prev)
      return
    }

    setIsSidebarCollapsed((prev) => !prev)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar isCollapsed={isSidebarCollapsed} isMobileOpen={isMobileSidebarOpen} onCloseMobile={() => setIsMobileSidebarOpen(false)} />

      {isMobileSidebarOpen ? (
        <button
          type="button"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-slate-950/55 lg:hidden print:hidden"
        />
      ) : null}

      <Header isSidebarCollapsed={isSidebarCollapsed} onToggleSidebar={handleToggleSidebar} />

      <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[96px]' : 'lg:pl-[280px]'}`}>
        <main className="px-4 pt-[104px] pb-6 md:px-6 md:pt-[110px]">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
