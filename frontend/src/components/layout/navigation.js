import {
  Archive,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Settings2,
  ShoppingCart,
  ShieldUser,
  UserCircle2,
  Users,
} from 'lucide-react'

export const navSections = [
  {
    title: 'MAIN',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], module: 'dashboard' },
      { path: '/orders', label: 'Orders', icon: ClipboardList, roles: ['admin', 'staff'], module: 'orders' },
      { path: '/pos', label: 'POS', icon: ShoppingCart, roles: ['admin', 'staff'], module: 'pos' },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { path: '/products', label: 'Products', icon: Boxes, roles: ['admin', 'staff'], module: 'products' },
      { path: '/inventory', label: 'Inventory', icon: Archive, roles: ['admin', 'staff'], module: 'inventory' },
      { path: '/customers', label: 'Customers', icon: Users, roles: ['admin', 'staff'], module: 'customers' },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { path: '/users', label: 'Users', icon: ShieldUser, roles: ['admin'], module: 'users' },
      { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin'], module: 'reports' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { path: '/profile', label: 'Profile', icon: UserCircle2, roles: ['admin', 'staff'] },
      { path: '/settings', label: 'Settings', icon: Settings2, roles: ['admin'] },
    ],
  },
]

const routeMatchers = [
  { match: (pathname) => pathname === '/', title: 'Dashboard', subtitle: 'Retail performance and operational overview' },
  { match: (pathname) => pathname.startsWith('/orders'), title: 'Orders', subtitle: 'Track billing, invoices, and order activity' },
  { match: (pathname) => pathname.startsWith('/pos'), title: 'Point Of Sale', subtitle: 'Process sales and customer billing faster' },
  { match: (pathname) => pathname.startsWith('/invoice/'), title: 'Invoice', subtitle: 'Review and print GST-ready invoice details' },
  { match: (pathname) => pathname === '/products', title: 'Products', subtitle: 'Manage your retail product master catalog' },
  { match: (pathname) => pathname === '/products/new', title: 'Add Product', subtitle: 'Create a new catalog item for the store' },
  { match: (pathname) => pathname.endsWith('/edit') && pathname.startsWith('/products/'), title: 'Edit Product', subtitle: 'Update product master information' },
  { match: (pathname) => pathname.startsWith('/products/'), title: 'Product Details', subtitle: 'Review pricing, tax, and catalog information' },
  { match: (pathname) => pathname === '/inventory', title: 'Inventory', subtitle: 'Control stock positions and replenishment' },
  { match: (pathname) => pathname.startsWith('/inventory/history'), title: 'Inventory History', subtitle: 'Audit every stock movement and user action' },
  { match: (pathname) => pathname.startsWith('/inventory/low-stock'), title: 'Low Stock', subtitle: 'Prioritize replenishment and shortage alerts' },
  { match: (pathname) => pathname.startsWith('/customers'), title: 'Customers', subtitle: 'Manage customer records and GST details' },
  { match: (pathname) => pathname.startsWith('/users'), title: 'Users', subtitle: 'Control staff access and system roles' },
  { match: (pathname) => pathname.startsWith('/reports'), title: 'Reports', subtitle: 'Review sales, inventory, customer, and GST reports' },
  { match: (pathname) => pathname.startsWith('/settings'), title: 'Settings', subtitle: 'Manage store, billing, and POS controls' },
  { match: (pathname) => pathname.startsWith('/profile'), title: 'Profile', subtitle: 'Review your account details and password settings' },
]

export const getPageMeta = (pathname, role) => {
  const matched = routeMatchers.find((entry) => entry.match(pathname))

  if (matched) {
    return matched
  }

  return {
    title: role === 'staff' ? 'POS' : 'BasketIQ',
    subtitle: 'Smart Retail Platform',
  }
}
