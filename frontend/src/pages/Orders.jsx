import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Ban, CalendarRange, Eye, RefreshCw, Search, ShoppingBag, Wallet } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useConfirmDialog } from '../context/ConfirmDialogContext'
import { useToast } from '../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage, getApiResponseData } from '../services/api'
import { getToken } from '../utils/auth'
import {
  formatOrderCount,
  formatOrderCurrency,
  formatOrderDateTime,
  getCustomerDisplayName,
  getInvoiceStatusBadgeClass,
  getInvoiceStatusLabel,
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
  getPaymentBadgeClass,
  getPaymentMethodLabel,
  isWalkInOrder,
} from '../utils/orderPresentation'

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
]

const paymentFilterOptions = [
  { value: '', label: 'All payments' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'split', label: 'Mixed / Split' },
]

const getOrderReference = (order) => order.invoiceNumber || `ORD-${String(order._id || '').slice(-8).toUpperCase()}`

const getItemCount = (order) =>
  (Array.isArray(order?.items) ? order.items : []).reduce((sum, item) => sum + Number(item?.quantity || 0), 0)

function SummaryCard({ label, value, helper, icon, tone = 'slate' }) {
  const SummaryIcon = icon
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : tone === 'danger'
          ? 'bg-rose-100 text-rose-700'
          : tone === 'brand'
            ? 'bg-indigo-100 text-indigo-700'
            : 'bg-slate-100 text-slate-700'

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
          <SummaryIcon size={20} />
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </article>
  )
}

function Orders() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionOrderId, setActionOrderId] = useState('')
  const [error, setError] = useState('')
  const customerIdFilter = searchParams.get('customerId') || ''
  const deferredSearchText = useDeferredValue(searchText)

  const fetchOrders = useCallback(async (filters = {}) => {
    setLoading(true)

    try {
      const query = new URLSearchParams()

      if (filters.status) query.set('status', filters.status)
      if (filters.paymentMethod) query.set('paymentMethod', filters.paymentMethod)
      if (filters.customerId) query.set('customerId', filters.customerId)
      if (filters.from) query.set('from', filters.from)
      if (filters.to) query.set('to', filters.to)
      if (filters.search) query.set('search', filters.search)

      const queryString = query.toString()
      const response = await api.get(queryString ? `/orders?${queryString}` : '/orders')
      setOrders(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load orders')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    void fetchOrders({
      status: statusFilter,
      paymentMethod: paymentFilter,
      customerId: customerIdFilter,
      from: fromDate,
      to: toDate,
      search: deferredSearchText.trim(),
    })
  }, [customerIdFilter, deferredSearchText, fetchOrders, fromDate, navigate, paymentFilter, statusFilter, toDate])

  const filteredOrders = useMemo(() => getApiArrayData(orders), [orders])

  const summary = useMemo(() => {
    return filteredOrders.reduce(
      (accumulator, order) => {
        const status = String(order.status || 'completed').toLowerCase()
        const paymentMethod = String(order.paymentMethod || 'cash').toLowerCase()
        const amount = Number(order.finalAmount || order.totalAmount || 0)

        accumulator.totalOrders += 1

        if (status === 'completed') {
          accumulator.completedOrders += 1
          accumulator.totalSales += amount
        }

        if (status === 'cancelled') {
          accumulator.cancelledOrders += 1
        }

        if (paymentMethod === 'cash') {
          accumulator.cashOrders += 1
        }

        if (isWalkInOrder(order)) {
          accumulator.walkInOrders += 1
        }

        return accumulator
      },
      {
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalSales: 0,
        cashOrders: 0,
        walkInOrders: 0,
      },
    )
  }, [filteredOrders])

  const handleStatusChange = useCallback(
    async (order, nextStatus) => {
      const shouldContinue = await confirm({
        title: `${nextStatus === 'cancelled' ? 'Cancel' : 'Refund'} ${getOrderReference(order)}?`,
        description:
          nextStatus === 'cancelled'
            ? 'The order will be marked as cancelled and its stock movement will be reversed once.'
            : 'The order will be marked as refunded and its stock movement will be reversed once.',
        confirmLabel: nextStatus === 'cancelled' ? 'Cancel order' : 'Refund order',
        cancelLabel: 'Keep order',
        tone: nextStatus === 'cancelled' ? 'warning' : 'danger',
      })

      if (!shouldContinue) {
        return
      }

      setActionOrderId(order._id)

      try {
        const response = await api.put(`/orders/${order._id}/status`, { status: nextStatus })
        const updatedOrder = getApiResponseData(response)

        setOrders((current) =>
          current.map((existingOrder) => (existingOrder._id === order._id && updatedOrder ? updatedOrder : existingOrder)),
        )

        showToast(`Order marked ${nextStatus}`, 'success')
      } catch (apiError) {
        const message = getApiErrorMessage(apiError, 'Failed to update order status')
        setError(message)
        showToast(message)
      } finally {
        setActionOrderId('')
      }
    },
    [confirm, showToast],
  )

  const clearAllFilters = () => {
    setSearchText('')
    setStatusFilter('')
    setPaymentFilter('')
    setFromDate('')
    setToDate('')
  }

  const clearCustomerFilter = () => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('customerId')
    setSearchParams(nextParams)
  }

  const summaryCards = [
    {
      label: 'Total Orders',
      value: formatOrderCount(summary.totalOrders),
      helper: 'Orders in the current view',
      icon: ShoppingBag,
      tone: 'brand',
    },
    {
      label: 'Completed Orders',
      value: formatOrderCount(summary.completedOrders),
      helper: 'Retail sales completed successfully',
      icon: Eye,
      tone: 'success',
    },
    {
      label: 'Cancelled Orders',
      value: formatOrderCount(summary.cancelledOrders),
      helper: 'Orders reversed from sales totals',
      icon: Ban,
      tone: 'warning',
    },
    {
      label: 'Total Sales',
      value: formatOrderCurrency(summary.totalSales),
      helper: 'Completed billing value in this view',
      icon: Wallet,
      tone: 'brand',
    },
    {
      label: 'Cash Orders',
      value: formatOrderCount(summary.cashOrders),
      helper: 'Orders paid fully in cash',
      icon: Wallet,
      tone: 'slate',
    },
    {
      label: 'Walk-in Orders',
      value: formatOrderCount(summary.walkInOrders),
      helper: 'Counter sales without a named customer',
      icon: ShoppingBag,
      tone: 'slate',
    },
  ]

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <ShoppingBag size={14} />
              Retail Order Operations
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Orders</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review POS transactions, invoice references, payment methods, and customer-linked retail sales in one practical order workspace.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Order Filters</h2>
            <p className="mt-1 text-sm text-slate-500">Search by invoice or customer, then narrow by status, payment, or date range.</p>
          </div>
          <button type="button" onClick={clearAllFilters} className="ds-btn ds-btn-secondary print:hidden">
            Clear Filters
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search order ID or customer"
              className="ds-input !w-full !py-2.5 !pr-3 !pl-9"
            />
          </label>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ds-select">
            {statusFilterOptions.map((option) => (
              <option key={option.value || 'all-status'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="ds-select">
            {paymentFilterOptions.map((option) => (
              <option key={option.value || 'all-payment'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 shadow-sm">
            <CalendarRange size={16} />
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="w-full bg-transparent text-slate-900 outline-none" />
          </label>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-500 shadow-sm">
            <CalendarRange size={16} />
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="w-full bg-transparent text-slate-900 outline-none" />
          </label>
        </div>

        {customerIdFilter ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
              Customer filter active
            </span>
            <button type="button" onClick={clearCustomerFilter} className="ds-btn ds-btn-secondary !px-3 !py-1.5 !text-xs">
              Clear Customer Filter
            </button>
          </div>
        ) : null}
      </section>

      {error ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <TableSkeleton columns={9} rows={10} />
      ) : (
        <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Retail Orders</h2>
              <p className="mt-1 text-sm text-slate-500">{formatOrderCount(filteredOrders.length)} orders in the current result set.</p>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-base font-semibold text-slate-900">No orders found</p>
              <p className="mt-2 text-sm text-slate-500">Try changing the filters or complete a sale in POS to create a retail transaction.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order / Invoice</th>
                    <th className="px-3 py-3 font-semibold">Date & Time</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold text-right">Items</th>
                    <th className="px-3 py-3 font-semibold text-right">Total Amount</th>
                    <th className="px-3 py-3 font-semibold">Payment</th>
                    <th className="px-3 py-3 font-semibold">Order Status</th>
                    <th className="px-3 py-3 font-semibold">Invoice Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const orderStatus = order.status || 'completed'

                    return (
                      <tr key={order._id} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-slate-950">{getOrderReference(order)}</p>
                            <p className="mt-1 text-xs text-slate-500">{order.invoiceNumber ? `Invoice ${order.invoiceNumber}` : 'Retail order record'}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatOrderDateTime(order.createdAt)}</td>
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium text-slate-900">{getCustomerDisplayName(order)}</p>
                            <p className="mt-1 text-xs text-slate-500">{isWalkInOrder(order) ? 'Walk-in customer' : 'Named customer'}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">{formatOrderCount(getItemCount(order))}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">
                          {formatOrderCurrency(order.finalAmount || order.totalAmount)}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getPaymentBadgeClass(order.paymentMethod)}`}
                          >
                            {getPaymentMethodLabel(order)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getOrderStatusBadgeClass(orderStatus)}`}
                          >
                            {getOrderStatusLabel(orderStatus)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getInvoiceStatusBadgeClass(orderStatus, order.invoiceNumber)}`}
                          >
                            {getInvoiceStatusLabel(orderStatus, order.invoiceNumber)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/orders/${order._id}`)}
                              className="ds-btn ds-btn-secondary !px-3 !py-2 !text-xs"
                            >
                              <Eye size={14} />
                              View
                            </button>
                            {orderStatus === 'completed' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(order, 'cancelled')}
                                  disabled={actionOrderId === order._id}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Ban size={14} />
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleStatusChange(order, 'refunded')}
                                  disabled={actionOrderId === order._id}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <RefreshCw size={14} />
                                  Refund
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default Orders
