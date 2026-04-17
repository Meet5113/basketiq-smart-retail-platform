import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DataTable from '../components/ui/DataTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import InventoryModuleNav from '../components/inventory/InventoryModuleNav'
import { useToast } from '../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage } from '../services/api'
import { getToken } from '../utils/auth'
import { formatDateTime, getStockMovementClass, getStockMovementLabel } from '../utils/inventoryModule'

const movementOptions = [
  { value: '', label: 'All movements' },
  { value: 'OPENING_STOCK', label: 'Opening Stock' },
  { value: 'STOCK_IN', label: 'Stock In' },
  { value: 'STOCK_OUT', label: 'Stock Out' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'SALE_DEDUCTION', label: 'Sale Deduction' },
]

const getDateRangeError = (fromDate, toDate) => {
  if (fromDate && toDate && fromDate > toDate) {
    return 'From date cannot be later than to date.'
  }

  return ''
}

function InventoryHistory() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [inventoryRows, setInventoryRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draftFilters, setDraftFilters] = useState({
    productId: '',
    movementType: '',
    fromDate: '',
    toDate: '',
  })
  const [dateError, setDateError] = useState('')

  const selectedProductId = searchParams.get('productId') || ''
  const movementType = searchParams.get('movementType') || ''
  const fromDate = searchParams.get('fromDate') || ''
  const toDate = searchParams.get('toDate') || ''

  useEffect(() => {
    setDraftFilters({
      productId: selectedProductId,
      movementType,
      fromDate,
      toDate,
    })
    setDateError(getDateRangeError(fromDate, toDate))
  }, [fromDate, movementType, selectedProductId, toDate])

  const updateDraftFilter = useCallback((key, value) => {
    setDraftFilters((current) => {
      const nextFilters = {
        ...current,
        [key]: value,
      }

      setDateError(getDateRangeError(nextFilters.fromDate, nextFilters.toDate))
      return nextFilters
    })
  }, [])

  const applyFilters = useCallback(() => {
    const nextDateError = getDateRangeError(draftFilters.fromDate, draftFilters.toDate)
    setDateError(nextDateError)

    if (nextDateError) {
      return
    }

    const nextParams = new URLSearchParams()

    if (draftFilters.productId) nextParams.set('productId', draftFilters.productId)
    if (draftFilters.movementType) nextParams.set('movementType', draftFilters.movementType)
    if (draftFilters.fromDate) nextParams.set('fromDate', draftFilters.fromDate)
    if (draftFilters.toDate) nextParams.set('toDate', draftFilters.toDate)

    setSearchParams(nextParams)
  }, [draftFilters, setSearchParams])

  const clearFilters = useCallback(() => {
    setDraftFilters({
      productId: '',
      movementType: '',
      fromDate: '',
      toDate: '',
    })
    setDateError('')
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  const fetchInventoryRows = useCallback(async () => {
    try {
      const response = await api.get('/inventory/current')
      setInventoryRows(getApiArrayData(response))
    } catch (apiError) {
      showToast(getApiErrorMessage(apiError, 'Failed to load inventory filter options'))
    }
  }, [showToast])

  const fetchHistory = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/inventory/history', {
        params: {
          productId: selectedProductId || undefined,
          movementType: movementType || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          limit: 200,
        },
      })

      setItems(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load stock history')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [fromDate, movementType, selectedProductId, showToast, toDate])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    fetchInventoryRows()
  }, [fetchInventoryRows, navigate])

  useEffect(() => {
    if (!getToken()) return
    if (getDateRangeError(fromDate, toDate)) {
      setItems([])
      setLoading(false)
      setError('')
      return
    }
    fetchHistory()
  }, [fetchHistory, fromDate, toDate])

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(right.movementDate || right.createdAt || 0).getTime() -
          new Date(left.movementDate || left.createdAt || 0).getTime(),
      ),
    [items],
  )

  const summary = useMemo(
    () => ({
      totalRows: sortedItems.length,
      stockInRows: sortedItems.filter((item) => String(item.movementType || item.type).toUpperCase() === 'STOCK_IN').length,
      stockOutRows: sortedItems.filter((item) =>
        ['STOCK_OUT', 'SALE_DEDUCTION'].includes(String(item.movementType || item.type).toUpperCase()),
      ).length,
      adjustmentRows: sortedItems.filter((item) => String(item.movementType || item.type).toUpperCase() === 'ADJUSTMENT').length,
    }),
    [sortedItems],
  )

  const hasActiveFilters = Boolean(selectedProductId || movementType || fromDate || toDate)
  const hasPendingFilterChanges =
    draftFilters.productId !== selectedProductId ||
    draftFilters.movementType !== movementType ||
    draftFilters.fromDate !== fromDate ||
    draftFilters.toDate !== toDate
  const hasAnyDraftFilters = Boolean(
    draftFilters.productId || draftFilters.movementType || draftFilters.fromDate || draftFilters.toDate,
  )

  const selectedProductLabel = useMemo(() => {
    const matchedProduct = inventoryRows.find((item) => String(item.productId) === selectedProductId)
    return matchedProduct ? `${matchedProduct.name} (${matchedProduct.sku || 'No SKU'})` : ''
  }, [inventoryRows, selectedProductId])

  const activeFilterSummary = useMemo(() => {
    const parts = []

    if (selectedProductLabel) {
      parts.push(`Product: ${selectedProductLabel}`)
    }

    if (movementType) {
      parts.push(`Movement: ${getStockMovementLabel(movementType)}`)
    }

    if (fromDate) {
      parts.push(`From: ${fromDate}`)
    }

    if (toDate) {
      parts.push(`To: ${toDate}`)
    }

    return parts
  }, [fromDate, movementType, selectedProductLabel, toDate])

  const columns = [
    {
      id: 'date',
      header: 'Date',
      cell: (item) => <span className="text-slate-700">{formatDateTime(item.createdAt || item.movementDate)}</span>,
    },
    {
      id: 'product',
      header: 'Product',
      cell: (item) => <span className="font-medium text-slate-900">{item.productName}</span>,
    },
    {
      id: 'sku',
      header: 'SKU',
      cell: (item) => <span className="text-slate-700">{item.sku || 'N/A'}</span>,
    },
    {
      id: 'movement',
      header: 'Movement Type',
      cell: (item) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getStockMovementClass(
            item.movementType || item.type,
          )}`}
        >
          {getStockMovementLabel(item.movementType || item.type)}
        </span>
      ),
    },
    {
      id: 'changeQty',
      header: 'Quantity Change',
      cell: (item) => (
        <span className={`font-semibold ${Number(item.changeQty || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {Number(item.changeQty || 0) > 0 ? '+' : ''}
          {item.changeQty}
        </span>
      ),
    },
    {
      id: 'beforeQty',
      header: 'Previous Stock',
      cell: (item) => <span className="text-slate-700">{item.beforeQty}</span>,
    },
    {
      id: 'afterQty',
      header: 'New Stock',
      cell: (item) => <span className="font-semibold text-slate-900">{item.afterQty}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (item) => (
        <div>
          <p className="text-slate-700">{item.reason || item.note || 'N/A'}</p>
          {item.note && item.reason && item.note !== item.reason ? (
            <p className="text-xs text-slate-500">{item.note}</p>
          ) : null}
        </div>
      ),
    },
    {
      id: 'user',
      header: 'User',
      cell: (item) => (
        <div>
          <p className="text-slate-700">{item.userName || 'System'}</p>
          <p className="text-xs uppercase tracking-wide text-slate-500">{item.userRole || 'system'}</p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <section className="ds-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Inventory History</h1>
            <p className="mt-1 text-sm text-slate-500">Audit all stock movements with before/after balances, reasons, and user context.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Rows: {summary.totalRows}</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">Inbound: {summary.stockInRows}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">Outbound: {summary.stockOutRows}</span>
            <span className="rounded-full bg-violet-100 px-3 py-1.5 text-violet-800">Adjustments: {summary.adjustmentRows}</span>
            <span className="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800">Sorted: Latest first</span>
          </div>
        </div>
      </section>

      <InventoryModuleNav />

      <section className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_220px_170px_170px_132px_126px] xl:items-end">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Product</span>
            <select
              value={draftFilters.productId}
              onChange={(event) => updateDraftFilter('productId', event.target.value)}
              className="ds-select h-10"
            >
              <option value="">All products</option>
              {inventoryRows.map((item) => (
                <option key={item.productId} value={item.productId}>
                  {item.name} ({item.sku || 'No SKU'})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Movement Type</span>
            <select
              value={draftFilters.movementType}
              onChange={(event) => updateDraftFilter('movementType', event.target.value)}
              className="ds-select h-10"
            >
              {movementOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">From Date</span>
            <input
              type="date"
              value={draftFilters.fromDate}
              onChange={(event) => updateDraftFilter('fromDate', event.target.value)}
              className={`ds-input h-10 ${dateError ? '!border-red-300 !ring-1 !ring-red-100 focus:!border-red-400 focus:!ring-red-100' : ''}`}
              aria-invalid={Boolean(dateError)}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">To Date</span>
            <input
              type="date"
              value={draftFilters.toDate}
              onChange={(event) => updateDraftFilter('toDate', event.target.value)}
              className={`ds-input h-10 ${dateError ? '!border-red-300 !ring-1 !ring-red-100 focus:!border-red-400 focus:!ring-red-100' : ''}`}
              aria-invalid={Boolean(dateError)}
            />
          </label>

          <div className="flex xl:justify-end">
            <button
              type="button"
              onClick={applyFilters}
              className="ds-btn ds-btn-primary h-10 w-full !px-3 !py-0 text-sm xl:w-auto"
              disabled={Boolean(dateError) || !hasPendingFilterChanges}
            >
              Apply
            </button>
          </div>

          <div className="flex xl:justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="ds-btn ds-btn-secondary h-10 w-full !px-3 !py-0 text-sm xl:w-auto"
              disabled={!hasActiveFilters && !hasAnyDraftFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {dateError ? <p className="mt-3 text-xs font-medium text-red-600">{dateError}</p> : null}

        <div className="mt-3 border-t border-slate-100 pt-3">
          {activeFilterSummary.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              {activeFilterSummary.map((entry) => (
                <span key={entry} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                  {entry}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Showing all stock movement records across products.</p>
          )}
        </div>
      </section>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {loading ? (
        <TableSkeleton columns={9} rows={10} />
      ) : (
        <DataTable
          columns={columns}
          data={sortedItems}
          rowKey="id"
          emptyState="No stock movements found for the selected filters."
          maxHeight="72vh"
          striped={false}
        />
      )}
    </div>
  )
}

export default InventoryHistory
