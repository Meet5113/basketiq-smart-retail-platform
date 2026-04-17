import { NavLink } from 'react-router-dom'
import { AlertTriangle, Boxes, History } from 'lucide-react'

const links = [
  { to: '/inventory', label: 'Inventory List', icon: Boxes, end: true },
  { to: '/inventory/history', label: 'Stock History', icon: History },
  { to: '/inventory/low-stock', label: 'Low Stock', icon: AlertTriangle },
]

function InventoryModuleNav() {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-3">
        {links.map((link) => {
          const Icon = link.icon

          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                }`
              }
            >
              <Icon size={16} />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

export default InventoryModuleNav
