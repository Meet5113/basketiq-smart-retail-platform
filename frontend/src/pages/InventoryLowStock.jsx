import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import InventoryModuleNav from '../components/inventory/InventoryModuleNav'
import InventoryStockDialog from '../components/inventory/InventoryStockDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage } from '../services/api'
import { getToken, getUserRole } from '../utils/auth'
import { getInventoryStatusClass } from '../utils/inventoryModule'

function InventoryLowStock() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const isAdmin = getUserRole() === 'admin'

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [actionMode, setActionMode] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [error, setError] = useState('')
  const [allowNegativeStock, setAllowNegativeStock] = useState(false)

  const fetchLowStock = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/inventory/low-stock')
      setItems(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load low stock items')
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

    void Promise.all([fetchLowStock(), fetchInventorySettings()])
  }, [fetchInventorySettings, fetchLowStock, navigate])

  const summary = useMemo(
    () => ({
      totalItems: items.length,
      outOfStock: items.filter((item) => String(item.stockStatus).toLowerCase() === 'out of stock').length,
      lowStock: items.filter((item) => String(item.stockStatus).toLowerCase() === 'low stock').length,
    }),
    [items],
  )

  const handleSubmitAction = async (payload) => {
    if (!selectedItem) return false

    setSubmitting(true)

    try {
      await api.post('/inventory/adjustments', {
        productId: selectedItem.productId,
        allowNegativeStock,
        ...payload,
      })
      await fetchLowStock()
      showToast('Inventory updated successfully', 'success')
      return true
    } catch (apiError) {
      showToast(getApiErrorMessage(apiError, 'Failed to update inventory'))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="ds-card">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Low Stock</h1>
            <p className="mt-1 text-sm text-slate-500">Prioritize replenishment items without leaving the inventory module.</p>
          </div>
          <div className="text-sm text-slate-500">
            <p>Low stock rows use each product&apos;s configured threshold.</p>
          </div>
        </div>
      </section>

      <InventoryModuleNav />

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="ds-card sm:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Low Stock Summary</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{summary.totalItems} products below threshold</p>
              <p className="mt-1 text-sm text-slate-500">
                {summary.outOfStock} out of stock and {summary.lowStock} running low based on each product&apos;s reorder threshold.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">Low stock: {summary.lowStock}</span>
              <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-800">Out of stock: {summary.outOfStock}</span>
            </div>
          </div>
        </article>
      </section>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {loading ? (
        <TableSkeleton columns={6} rows={8} />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100/80 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">SKU</th>
                  <th className="px-3 py-3 text-right font-semibold">Current Stock</th>
                  <th className="px-3 py-3 text-right font-semibold">Threshold</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      No low stock products found.
                    </td>
                  </tr>
                ) : (
                  items.map((item, index) => {
                    const isBusyRow = submitting && selectedItem?.productId === item.productId

                    return (
                      <tr
                        key={item.productId}
                        className={`border-t border-slate-100 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                        } hover:bg-slate-100/70`}
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-[220px]">
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.category || 'Uncategorized'}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle text-slate-700">{item.sku || 'N/A'}</td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="font-semibold tabular-nums text-slate-900">{item.stock}</span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="tabular-nums text-slate-700">{item.lowStockThreshold ?? item.reorderPoint ?? 0}</span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getInventoryStatusClass(item.stockStatus)}`}>
                            {item.stockStatus || 'In Stock'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <div className="flex flex-wrap justify-end gap-2">
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionMode('add')
                                  setSelectedItem(item)
                                }}
                                disabled={isBusyRow}
                                className="ds-btn ds-btn-primary !px-3 !py-1.5 !text-xs disabled:opacity-60"
                              >
                                {isBusyRow ? 'Updating...' : 'Add Stock'}
                              </button>
                            ) : null}
                            <Link to={`/products/${item.productId}`} className="ds-btn ds-btn-secondary !px-3 !py-1.5 !text-xs">
                              View Product
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <InventoryStockDialog
        key={`${actionMode}-${selectedItem?.productId || 'none'}-${selectedItem?.stock ?? ''}`}
        open={Boolean(actionMode && selectedItem)}
        mode={actionMode}
        item={selectedItem}
        submitting={submitting}
        allowNegativeStock={allowNegativeStock}
        onClose={() => {
          setActionMode('')
          setSelectedItem(null)
        }}
        onSubmit={handleSubmitAction}
      />
    </div>
  )
}

export default InventoryLowStock
