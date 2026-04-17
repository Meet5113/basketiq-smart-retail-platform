import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import InventoryModuleNav from '../components/inventory/InventoryModuleNav'
import InventoryStockDialog from '../components/inventory/InventoryStockDialog'
import InventoryStockTable from '../components/inventory/InventoryStockTable'
import { useToast } from '../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage } from '../services/api'
import { getToken, getUserRole } from '../utils/auth'

function InventoryList() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isAdmin = getUserRole() === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionMode, setActionMode] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [error, setError] = useState('')
  const [allowNegativeStock, setAllowNegativeStock] = useState(false)
  const selectedProductId = searchParams.get('productId') || ''

  const fetchInventory = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/inventory/current')
      setItems(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load inventory')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const fetchInventorySettings = useCallback(async () => {
    try {
      const response = await api.get('/pos/settings')
      setAllowNegativeStock(Boolean(response?.allowNegativeStock))
    } catch (apiError) {
      showToast(getApiErrorMessage(apiError, 'Failed to load inventory settings'))
    }
  }, [showToast])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    void Promise.all([fetchInventory(), fetchInventorySettings()])
  }, [fetchInventory, fetchInventorySettings, navigate])

  const categories = useMemo(
    () => [...new Set(items.map((item) => String(item.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  )

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    return items.filter((item) => {
      const haystack = [item.name, item.sku, item.category].map((value) => String(value || '').toLowerCase()).join(' ')
      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch)
      const matchesProduct = !selectedProductId || String(item.productId) === selectedProductId
      const matchesCategory = !categoryFilter || String(item.category || '') === categoryFilter
      const matchesStatus = !statusFilter || String(item.stockStatus || '').toLowerCase() === statusFilter

      return matchesSearch && matchesProduct && matchesCategory && matchesStatus
    })
  }, [categoryFilter, items, searchText, selectedProductId, statusFilter])

  const summary = useMemo(
    () => ({
      totalItems: filteredItems.length,
      lowStock: filteredItems.filter((item) => String(item.stockStatus).toLowerCase() === 'low stock').length,
      outOfStock: filteredItems.filter((item) => String(item.stockStatus).toLowerCase() === 'out of stock').length,
    }),
    [filteredItems],
  )

  const handleOpenAction = (mode, item) => {
    setActionMode(mode)
    setSelectedItem(item)
  }

  const handleCloseAction = () => {
    setActionMode('')
    setSelectedItem(null)
  }

  const handleSubmitAction = async (payload) => {
    if (!selectedItem) return false

    setSubmitting(true)

    try {
      await api.post('/inventory/adjustments', {
        productId: selectedItem.productId,
        allowNegativeStock,
        ...payload,
      })
      await fetchInventory()
      showToast('Inventory updated successfully', 'success')
      return true
    } catch (apiError) {
      showToast(getApiErrorMessage(apiError, 'Failed to update inventory'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const focusedProduct = useMemo(
    () => items.find((item) => String(item.productId) === selectedProductId) || null,
    [items, selectedProductId],
  )

  const clearProductFocus = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('productId')
    setSearchParams(nextParams)
  }, [searchParams, setSearchParams])

  return (
    <div className="space-y-3">
      <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[2rem] font-semibold tracking-tight text-slate-900">Inventory</h1>
            <p className="mt-1 text-sm text-slate-500">Fast stock control view for current balances, thresholds, and recent movement.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Items: {summary.totalItems}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Low stock: {summary.lowStock}</span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">Out of stock: {summary.outOfStock}</span>
            {!isAdmin ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">View-only access</span> : null}
          </div>
        </div>
      </section>

      <InventoryModuleNav />

      <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_280px_280px_154px]">
          <div className="relative xl:min-w-[320px]">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search product name or SKU"
              className="ds-input h-11 !pl-9"
            />
          </div>

          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="ds-select h-11">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ds-select h-11">
            <option value="">All stock statuses</option>
            <option value="in stock">In Stock</option>
            <option value="low stock">Low Stock</option>
            <option value="out of stock">Out of Stock</option>
          </select>

          <div className="flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">{filteredItems.length}</span>
            <span className="ml-1">visible rows</span>
          </div>
        </div>

        {focusedProduct ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-800">
              Focused product: {focusedProduct.name} ({focusedProduct.sku || 'No SKU'})
            </span>
            <button type="button" onClick={clearProductFocus} className="ds-btn ds-btn-secondary !px-3 !py-1.5 !text-xs">
              Clear product focus
            </button>
          </div>
        ) : null}
      </section>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <InventoryStockTable
        data={filteredItems}
        loading={loading}
        isAdmin={isAdmin}
        actionProductId={submitting ? selectedItem?.productId : ''}
        onAction={handleOpenAction}
      />

      <InventoryStockDialog
        key={`${actionMode}-${selectedItem?.productId || 'none'}-${selectedItem?.stock ?? ''}`}
        open={Boolean(actionMode && selectedItem)}
        mode={actionMode}
        item={selectedItem}
        submitting={submitting}
        allowNegativeStock={allowNegativeStock}
        onClose={handleCloseAction}
        onSubmit={handleSubmitAction}
      />
    </div>
  )
}

export default InventoryList
