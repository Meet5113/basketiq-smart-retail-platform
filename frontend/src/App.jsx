import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import ProductForm from './pages/ProductForm'
import POS from './pages/POS'
import Invoice from './pages/Invoice'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Customers from './pages/Customers'
import InventoryList from './pages/InventoryList'
import InventoryHistory from './pages/InventoryHistory'
import InventoryLowStock from './pages/InventoryLowStock'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/layout/Layout'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin', 'staff']}>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="inventory">
              <InventoryList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/history"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="inventory">
              <InventoryHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/low-stock"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="inventory">
              <InventoryLowStock />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="products">
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/new"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredModule="products">
              <ProductForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="products">
              <ProductDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id/edit"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredModule="products">
              <ProductForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pos"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="pos">
              <ErrorBoundary pageName="POS">
                <POS />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoice/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="orders">
              <Invoice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="orders">
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="orders">
              <OrderDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredModule="reports">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredModule="users">
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']} requiredModule="customers">
              <Customers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={['admin', 'staff']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute allowedRoles={['admin']} requiredModule="dashboard">
              <ErrorBoundary pageName="Dashboard">
                <Dashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
      </Route>
      <Route
        path="*"
        element={
          <Navigate to="/login" replace />
        }
      />
    </Routes>
  )
}

export default App
