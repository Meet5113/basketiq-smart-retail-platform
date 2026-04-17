import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Filter, RefreshCcw } from 'lucide-react'
import DataTable from '../components/ui/DataTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage, getApiResponseData } from '../services/api'
import { getToken } from '../utils/auth'

const defaultFilters = {
  datePreset: 'last30',
  customFrom: '',
  customTo: '',
  productId: '',
  category: '',
  customerId: '',
  paymentMethod: '',
}

const reportTabs = [
  { value: 'sales', label: 'Sales Report', description: 'Completed order activity with GST and payment details.' },
  { value: 'product', label: 'Product Report', description: 'Sell-through, revenue, profit, and live stock.' },
  { value: 'inventory', label: 'Inventory Report', description: 'Opening, inward, outward, and closing stock movement.' },
  { value: 'customer', label: 'Customer Report', description: 'Customer buying patterns and spend visibility.' },
  { value: 'gst', label: 'GST Report', description: 'Taxable value and tax collection by GST slab.' },
]

const gstTabs = ['0', '5', '12', '18', '28']

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const formatCount = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatPaymentMethod = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return 'N/A'
  if (normalized === 'upi') return 'UPI'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const escapeCsvCell = (value) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const buildReportQuery = (filters) => {
  const query = new URLSearchParams()
  query.set('datePreset', filters.datePreset || 'last30')
  if (filters.datePreset === 'custom') {
    if (filters.customFrom) query.set('from', filters.customFrom)
    if (filters.customTo) query.set('to', filters.customTo)
  }
  if (filters.productId) query.set('productId', filters.productId)
  if (filters.category) query.set('category', filters.category)
  if (filters.customerId) query.set('customerId', filters.customerId)
  if (filters.paymentMethod) query.set('paymentMethod', filters.paymentMethod)
  return query.toString()
}

const SummaryCard = ({ label, value, helper }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
  </div>
)

const resolveOptionLabel = (options, value, fallback) => {
  if (!value) return fallback
  return getApiArrayData(options).find((option) => option.value === value)?.label || fallback
}

function Reports() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [filterOptions, setFilterOptions] = useState(null)
  const [draftFilters, setDraftFilters] = useState(defaultFilters)
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters)
  const [reportData, setReportData] = useState(null)
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [loadingReports, setLoadingReports] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('sales')
  const [activeGstRate, setActiveGstRate] = useState('0')

  const fetchFilterOptions = useCallback(async () => {
    setLoadingFilters(true)
    try {
      const response = await api.get('/reports/filter-options')
      setFilterOptions(getApiResponseData(response))
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load report filters')
      setError(message)
      showToast(message)
    } finally {
      setLoadingFilters(false)
    }
  }, [showToast])

  const fetchReports = useCallback(
    async (filters) => {
      if (filters.datePreset === 'custom' && (!filters.customFrom || !filters.customTo)) {
        const message = 'Choose both from and to dates for a custom report range.'
        setError(message)
        showToast(message)
        setLoadingReports(false)
        return
      }

      setLoadingReports(true)
      setError('')
      try {
        const response = await api.get(`/reports/business?${buildReportQuery(filters)}`)
        setReportData(getApiResponseData(response))
      } catch (apiError) {
        const message = getApiErrorMessage(apiError, 'Failed to load retail reports')
        setError(message)
        showToast(message)
      } finally {
        setLoadingReports(false)
      }
    },
    [showToast],
  )

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }
    void fetchFilterOptions()
  }, [fetchFilterOptions, navigate])

  useEffect(() => {
    if (!getToken()) return
    void fetchReports(appliedFilters)
  }, [appliedFilters, fetchReports])

  const updateDraftFilter = (field, value) => {
    setDraftFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'datePreset' && value !== 'custom' ? { customFrom: '', customTo: '' } : {}),
      ...(field === 'productId' && value ? { category: '' } : {}),
    }))
  }

  const handleResetFilters = () => {
    setDraftFilters(defaultFilters)
    setAppliedFilters(defaultFilters)
  }

  const salesRows = useMemo(() => getApiArrayData(reportData?.salesReport?.rows), [reportData])
  const productRows = useMemo(() => getApiArrayData(reportData?.productReport?.rows), [reportData])
  const inventoryRows = useMemo(() => getApiArrayData(reportData?.inventoryReport?.rows), [reportData])
  const customerRows = useMemo(() => getApiArrayData(reportData?.customerReport?.rows), [reportData])
  const gstRates = useMemo(() => getApiArrayData(reportData?.gstReport?.rates), [reportData])
  const activeGstBucket = useMemo(
    () => gstRates.find((rate) => String(rate.rate) === activeGstRate) || gstRates[0] || { summary: {}, rows: [] },
    [activeGstRate, gstRates],
  )

  const appliedFilterSummary = useMemo(() => {
    const applied = reportData?.appliedFilters || {}
    const dateLabel =
      resolveOptionLabel(filterOptions?.datePresets, applied.datePreset, 'Last 30 Days') ||
      'Last 30 Days'
    const categoryLabel = applied.category || 'All Categories'
    const customerLabel = resolveOptionLabel(filterOptions?.customers, applied.customerId, 'All Customers')
    const paymentLabel = resolveOptionLabel(filterOptions?.paymentMethods, applied.paymentMethod, 'All Payment Methods')

    if (applied.datePreset === 'custom' && applied.from && applied.to) {
      return `Showing data for ${formatDate(applied.from)} to ${formatDate(applied.to)} • ${categoryLabel} • ${customerLabel} • ${paymentLabel}`
    }

    return `Showing data for ${dateLabel} • ${categoryLabel} • ${customerLabel} • ${paymentLabel}`
  }, [filterOptions, reportData])

  const activeSummaryCards = useMemo(() => {
    if (activeTab === 'sales') {
      const summary = reportData?.salesReport?.summary || {}
      return [
        { label: 'Completed Orders', value: formatCount(summary.totalOrders) },
        { label: 'Items Sold', value: formatCount(summary.totalItems) },
        { label: 'Sales Value', value: formatCurrency(summary.totalAmount) },
        { label: 'GST Collected', value: formatCurrency(summary.totalGst) },
      ]
    }
    if (activeTab === 'product') {
      const summary = reportData?.productReport?.summary || {}
      return [
        { label: 'Products', value: formatCount(summary.totalProducts) },
        { label: 'Quantity Sold', value: formatCount(summary.totalQuantitySold) },
        { label: 'Revenue', value: formatCurrency(summary.totalRevenue) },
        { label: 'Profit', value: formatCurrency(summary.totalProfit) },
      ]
    }
    if (activeTab === 'inventory') {
      const summary = reportData?.inventoryReport?.summary || {}
      return [
        { label: 'Tracked Products', value: formatCount(summary.totalProducts) },
        { label: 'Stock In', value: formatCount(summary.totalStockIn) },
        { label: 'Stock Out', value: formatCount(summary.totalStockOut) },
        { label: 'Low Stock Items', value: formatCount(summary.lowStockCount), helper: 'Based on closing stock in the selected period.' },
      ]
    }
    if (activeTab === 'customer') {
      const summary = reportData?.customerReport?.summary || {}
      return [
        { label: 'Customers', value: formatCount(summary.totalCustomers) },
        { label: 'Orders', value: formatCount(summary.totalOrders) },
        { label: 'Total Spend', value: formatCurrency(summary.totalSpend) },
        { label: 'GST Customers', value: formatCount(summary.gstCustomers) },
      ]
    }
    return [
      { label: 'GST Slab', value: `${activeGstBucket?.rate ?? 0}%` },
      { label: 'Taxable Value', value: formatCurrency(activeGstBucket?.summary?.totalTaxableValue) },
      {
        label: 'Tax Breakdown',
        value: formatCurrency(activeGstBucket?.summary?.totalGstCollected),
        helper: `CGST ${formatCurrency(activeGstBucket?.summary?.totalCgst)} • SGST ${formatCurrency(activeGstBucket?.summary?.totalSgst)} • IGST ${formatCurrency(activeGstBucket?.summary?.totalIgst)}`,
      },
      { label: 'Invoice Total', value: formatCurrency(activeGstBucket?.summary?.totalInvoiceValue), helper: `${formatCount(activeGstBucket?.summary?.totalRows)} taxed line items` },
    ]
  }, [activeGstBucket, activeTab, reportData])

  const activeTableConfig = useMemo(() => {
    if (activeTab === 'sales') {
      return {
        columns: [
          { id: 'date', header: 'Date', cell: (row) => <span className="text-slate-700">{formatDate(row.date)}</span> },
          { id: 'orderId', header: 'Order ID', cell: (row) => <span className="font-medium text-slate-900">{row.orderId}</span> },
          { id: 'customer', header: 'Customer', cell: (row) => <span className="text-slate-700">{row.customer}</span> },
          {
            id: 'items',
            header: 'Items',
            cell: (row) => {
              const preview = row.itemNames?.slice(0, 2).join(', ') || 'No items'
              const suffix = row.itemNames?.length > 2 ? ` +${row.itemNames.length - 2} more` : ''
              return (
                <div>
                  <p className="font-medium text-slate-900">{formatCount(row.totalQuantity)} units</p>
                  <p className="text-xs text-slate-500">{preview}{suffix}</p>
                </div>
              )
            },
          },
          { id: 'totalAmount', header: 'Total Amount', cell: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.totalAmount)}</span> },
          { id: 'gstAmount', header: 'GST', cell: (row) => <span className="text-slate-700">{formatCurrency(row.gstAmount)}</span> },
          { id: 'paymentMethod', header: 'Payment Method', cell: (row) => <span className="text-slate-700">{formatPaymentMethod(row.paymentMethod)}</span> },
        ],
        data: salesRows,
        emptyState: 'No completed sales found for the selected filters.',
      }
    }

    if (activeTab === 'product') {
      return {
        columns: [
          { id: 'productName', header: 'Product Name', cell: (row) => <span className="font-medium text-slate-900">{row.productName}</span> },
          { id: 'sku', header: 'SKU', cell: (row) => <span className="text-slate-700">{row.sku || 'N/A'}</span> },
          { id: 'quantitySold', header: 'Quantity Sold', cell: (row) => <span className="text-slate-700">{formatCount(row.quantitySold)}</span> },
          { id: 'revenue', header: 'Revenue', cell: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.revenue)}</span> },
          { id: 'profit', header: 'Profit', cell: (row) => <span className="text-slate-700">{formatCurrency(row.profit)}</span> },
          { id: 'currentStock', header: 'Current Stock', cell: (row) => <span className="text-slate-700">{formatCount(row.currentStock)}</span> },
        ],
        data: productRows,
        emptyState: 'No product data found for the selected filters.',
      }
    }

    if (activeTab === 'inventory') {
      return {
        columns: [
          { id: 'product', header: 'Product', cell: (row) => <span className="font-medium text-slate-900">{row.product}</span> },
          { id: 'openingStock', header: 'Opening Stock', cell: (row) => <span className="text-slate-700">{formatCount(row.openingStock)}</span> },
          { id: 'stockIn', header: 'Stock In', cell: (row) => <span className="text-emerald-700">{formatCount(row.stockIn)}</span> },
          { id: 'stockOut', header: 'Stock Out', cell: (row) => <span className="text-rose-700">{formatCount(row.stockOut)}</span> },
          { id: 'closingStock', header: 'Closing Stock', cell: (row) => <span className="font-semibold text-slate-900">{formatCount(row.closingStock)}</span> },
          {
            id: 'lowStockIndicator',
            header: 'Low Stock Indicator',
            cell: (row) => {
              const tone =
                row.lowStockIndicator === 'Out of Stock'
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : row.lowStockIndicator === 'Low Stock'
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{row.lowStockIndicator}</span>
            },
          },
        ],
        data: inventoryRows,
        emptyState: 'No inventory movements found for the selected product and date filters.',
      }
    }

    if (activeTab === 'customer') {
      return {
        columns: [
          { id: 'customerName', header: 'Customer Name', cell: (row) => <span className="font-medium text-slate-900">{row.customerName}</span> },
          { id: 'ordersCount', header: 'Orders Count', cell: (row) => <span className="text-slate-700">{formatCount(row.ordersCount)}</span> },
          { id: 'totalSpend', header: 'Total Spend', cell: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.totalSpend)}</span> },
          { id: 'lastPurchaseDate', header: 'Last Purchase Date', cell: (row) => <span className="text-slate-700">{formatDate(row.lastPurchaseDate)}</span> },
          { id: 'customerType', header: 'Customer Type', cell: (row) => <span className="text-slate-700">{row.customerType}</span> },
        ],
        data: customerRows,
        emptyState: 'No customer purchases found for the selected filters.',
      }
    }

    return {
      columns: [
        { id: 'date', header: 'Date', cell: (row) => <span className="text-slate-700">{formatDate(row.date)}</span> },
        { id: 'invoiceId', header: 'Invoice ID', cell: (row) => <span className="font-medium text-slate-900">{row.invoiceId}</span> },
        { id: 'product', header: 'Product', cell: (row) => <span className="text-slate-700">{row.product}</span> },
        { id: 'taxableValue', header: 'Taxable Value', cell: (row) => <span className="text-slate-700">{formatCurrency(row.taxableValue)}</span> },
        { id: 'gstRate', header: 'GST Rate', cell: (row) => <span className="text-slate-700">{row.gstRate}%</span> },
        { id: 'cgst', header: 'CGST', cell: (row) => <span className="text-slate-700">{formatCurrency(row.cgst)}</span> },
        { id: 'sgst', header: 'SGST', cell: (row) => <span className="text-slate-700">{formatCurrency(row.sgst)}</span> },
        { id: 'igst', header: 'IGST', cell: (row) => <span className="text-slate-700">{formatCurrency(row.igst)}</span> },
        { id: 'total', header: 'Total', cell: (row) => <span className="font-semibold text-slate-900">{formatCurrency(row.total)}</span> },
      ],
      data: getApiArrayData(activeGstBucket?.rows),
      emptyState: `No ${activeGstBucket?.rate ?? 0}% GST rows found for the selected filters.`,
    }
  }, [activeGstBucket, activeTab, customerRows, inventoryRows, productRows, salesRows])

  const activeTabMeta = reportTabs.find((tab) => tab.value === activeTab) || reportTabs[0]

  const handleExportCsv = () => {
    if (!reportData) {
      showToast('No report data to export')
      return
    }

    const rows = [[activeTabMeta.label], ['Date Range', `${formatDate(reportData?.appliedFilters?.from)} to ${formatDate(reportData?.appliedFilters?.to)}`], []]
    if (activeTab === 'sales') {
      rows.push(['Date', 'Order ID', 'Customer', 'Items', 'Total Amount', 'GST', 'Payment Method'])
      salesRows.forEach((row) => rows.push([formatDate(row.date), row.orderId, row.customer, `${formatCount(row.totalQuantity)} units - ${(row.itemNames || []).join(', ')}`, row.totalAmount, row.gstAmount, formatPaymentMethod(row.paymentMethod)]))
    } else if (activeTab === 'product') {
      rows.push(['Product Name', 'SKU', 'Quantity Sold', 'Revenue', 'Profit', 'Current Stock'])
      productRows.forEach((row) => rows.push([row.productName, row.sku || 'N/A', row.quantitySold, row.revenue, row.profit, row.currentStock]))
    } else if (activeTab === 'inventory') {
      rows.push(['Product', 'Opening Stock', 'Stock In', 'Stock Out', 'Closing Stock', 'Low Stock Indicator'])
      inventoryRows.forEach((row) => rows.push([row.product, row.openingStock, row.stockIn, row.stockOut, row.closingStock, row.lowStockIndicator]))
    } else if (activeTab === 'customer') {
      rows.push(['Customer Name', 'Orders Count', 'Total Spend', 'Last Purchase Date', 'Customer Type'])
      customerRows.forEach((row) => rows.push([row.customerName, row.ordersCount, row.totalSpend, formatDate(row.lastPurchaseDate), row.customerType]))
    } else {
      rows.push(['Date', 'Invoice ID', 'Product', 'Taxable Value', 'GST Rate', 'CGST', 'SGST', 'IGST', 'Total'])
      getApiArrayData(activeGstBucket?.rows).forEach((row) => rows.push([formatDate(row.date), row.invoiceId, row.product, row.taxableValue, row.gstRate, row.cgst, row.sgst, row.igst, row.total]))
    }

    const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `basketiq-${activeTab}-report-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Report exported', 'success')
  }

  const hasAnyReportRows = salesRows.length > 0 || productRows.length > 0 || inventoryRows.length > 0 || customerRows.length > 0 || gstRates.some((rate) => getApiArrayData(rate.rows).length > 0)

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Retail Reporting</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Business Reports</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">A cleaner, table-focused reporting workspace for sales, products, inventory, customers, and GST.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void fetchReports(appliedFilters)} className="ds-btn ds-btn-secondary">
              <RefreshCcw size={16} className="mr-1.5" />
              Refresh
            </button>
            <button type="button" onClick={handleExportCsv} className="ds-btn ds-btn-primary" disabled={!reportData}>
              <Download size={16} className="mr-1.5" />
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Filter size={14} />
            Filters
          </div>
          <p className="text-sm text-slate-500">Refine the reporting view with date, category, customer, and payment filters.</p>
        </div>

        {loadingFilters ? (
          <div className="mt-4">
            <TableSkeleton columns={6} rows={3} withFooter={false} />
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Date Range</span>
                    <select value={draftFilters.datePreset} onChange={(event) => updateDraftFilter('datePreset', event.target.value)} className="ds-select h-11 w-full">
                      {getApiArrayData(filterOptions?.datePresets).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Category</span>
                    <select value={draftFilters.category} onChange={(event) => updateDraftFilter('category', event.target.value)} className="ds-select h-11 w-full">
                      <option value="">All Categories</option>
                      {getApiArrayData(filterOptions?.categories).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Customer</span>
                    <select value={draftFilters.customerId} onChange={(event) => updateDraftFilter('customerId', event.target.value)} className="ds-select h-11 w-full">
                      <option value="">All Customers</option>
                      {getApiArrayData(filterOptions?.customers).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payment Method</span>
                    <select value={draftFilters.paymentMethod} onChange={(event) => updateDraftFilter('paymentMethod', event.target.value)} className="ds-select h-11 w-full">
                      <option value="">All Payment Methods</option>
                      {getApiArrayData(filterOptions?.paymentMethods).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                  <button type="button" onClick={() => setAppliedFilters(draftFilters)} className="ds-btn ds-btn-primary min-w-[104px] !px-5 !py-2.5">
                    Apply
                  </button>
                  <button type="button" onClick={handleResetFilters} className="ds-btn ds-btn-secondary min-w-[96px] !px-5 !py-2.5">
                    Reset
                  </button>
                </div>
              </div>

              {draftFilters.datePreset === 'custom' ? (
                <div className="grid gap-4 md:grid-cols-2 xl:max-w-[calc(50%-0.5rem)]">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Custom Start Date</span>
                    <input type="date" value={draftFilters.customFrom} onChange={(event) => updateDraftFilter('customFrom', event.target.value)} className="ds-input h-11" />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Custom End Date</span>
                    <input type="date" value={draftFilters.customTo} onChange={(event) => updateDraftFilter('customTo', event.target.value)} className="ds-input h-11" />
                  </label>
                </div>
              ) : null}

              <div className="rounded-2xl bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
                {appliedFilterSummary}
              </div>
            </div>
          </>
        )}
      </section>

      {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</section> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {reportTabs.map((tab) => {
            const isActive = tab.value === activeTab
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <h2 className="text-lg font-semibold text-slate-950">{activeTabMeta.label}</h2>
          <p className="mt-1 text-sm text-slate-500">{activeTabMeta.description}</p>
          {activeTab === 'inventory' ? <p className="mt-2 text-xs text-slate-500">Inventory balances follow the selected date, product, and category scope using stock movement data.</p> : null}
        </div>

        {activeTab === 'gst' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {gstTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveGstRate(tab)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${tab === activeGstRate ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
              >
                {tab}%
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {activeSummaryCards.map((item) => <SummaryCard key={item.label} label={item.label} value={item.value} helper={item.helper} />)}
        </div>

        <div className="mt-5">
          {loadingReports ? (
            <TableSkeleton columns={activeTableConfig.columns.length || 6} rows={8} />
          ) : hasAnyReportRows ? (
            <DataTable columns={activeTableConfig.columns} data={activeTableConfig.data} rowKey="id" emptyState={activeTableConfig.emptyState} striped={false} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-12 text-center">
              <p className="text-base font-semibold text-slate-900">No report data available</p>
              <p className="mt-2 text-sm text-slate-500">Complete transactions or adjust your filters to populate this reporting workspace.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Reports
