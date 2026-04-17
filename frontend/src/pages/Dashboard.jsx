import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Boxes, CalendarRange, ChevronRight, Download, IndianRupee, ReceiptText, RefreshCcw, ShoppingBag } from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from '../components/ui/ChartContainer'
import { CardSkeleton } from '../components/ui/Skeleton'
import api, { getApiArrayData, getApiErrorMessage } from '../services/api'
import { getToken } from '../utils/auth'
import { useToast } from '../context/ToastContext'

const chartTheme = {
  primary: '#172554',
  primarySoft: '#4f46e5',
  secondary: '#6366f1',
  secondarySoft: '#a5b4fc',
  positive: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  grid: '#e2e8f0',
  label: '#64748b',
  hover: 'rgba(15, 23, 42, 0.04)',
}

const rangeOptions = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
]

const dashboardRangePresetMap = {
  today: 'today',
  week: 'last7',
  month: 'last30',
}

const rangeCopy = {
  today: 'today',
  week: 'last 7 days',
  month: 'last 30 days',
}

const donutColors = ['#172554', '#3b82f6', '#cbd5e1', '#94a3b8', '#e5e7eb', '#cbd5e1', '#94a3b8']

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const formatCount = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0))

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`

const formatDate = (value) => {
  if (!value) return 'N/A'

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'N/A'

  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatCompactCurrency = (value) => {
  const amount = Number(value || 0)
  const absolute = Math.abs(amount)

  if (absolute >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  }

  if (absolute >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  }

  if (absolute >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`
  }

  return `₹${amount.toFixed(0)}`
}

const formatDateTime = (value) => {
  if (!value) return 'N/A'

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return 'N/A'

  return parsedDate.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const escapeCsvCell = (value) => {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

const shortenLabel = (value, limit = 12) => {
  const text = String(value || '').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1)}…`
}

const getStatusBadgeClass = (status) => {
  const normalizedStatus = String(status || '').toLowerCase()

  if (normalizedStatus === 'completed') return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
  if (normalizedStatus === 'cancelled') return 'bg-rose-100 text-rose-700 ring-rose-200'
  if (normalizedStatus === 'refunded') return 'bg-amber-100 text-amber-700 ring-amber-200'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

const getLowStockBadge = (product) => {
  const stock = Number(product?.stock ?? product?.currentStock ?? 0)

  if (stock <= 0) {
    return { label: 'Out of stock', className: 'bg-rose-100 text-rose-700 ring-rose-200' }
  }

  return { label: 'Low stock', className: 'bg-amber-100 text-amber-700 ring-amber-200' }
}

function EmptyPanel({ title, description, actionLabel, onAction, compact = false }) {
  return (
    <div
      className={`flex flex-col items-start justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 ${
        compact ? 'py-6' : 'py-12'
      }`}
    >
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="mt-4 ds-btn ds-btn-secondary">
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function SectionCard({ title, subtitle, insight, actionSlot, children, className = '' }) {
  return (
    <section className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          {insight ? <p className="mt-2 text-sm font-medium text-slate-700">{insight}</p> : null}
        </div>
        {actionSlot}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function SummaryMetricCard({ label, value, helper, icon }) {
  const Icon = icon

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon size={20} />
        </div>
      </div>
    </article>
  )
}

function TooltipCard({ title, value, helper }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-950">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

const renderCurrencyBarLabel = ({ x, y, width, value }) => {
  if (value == null) return null

  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 10} fill={chartTheme.primary} textAnchor="middle" fontSize={11} fontWeight={700}>
      {formatCompactCurrency(value)}
    </text>
  )
}

const renderCountBarLabel = ({ x, y, width, value }) => {
  if (value == null) return null

  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 10} fill={chartTheme.primary} textAnchor="middle" fontSize={11} fontWeight={700}>
      {formatCount(value)}
    </text>
  )
}

const renderRevenueActiveDot = ({ cx, cy, payload }) => {
  const total = Number(payload?.total || 0)
  const radius = total > 0 ? 5 : 3
  const fill = total > 0 ? '#ffffff' : '#e2e8f0'
  const stroke = total > 0 ? chartTheme.primary : '#cbd5e1'

  return <circle cx={cx} cy={cy} r={radius} fill={fill} stroke={stroke} strokeWidth={2} />
}

const renderActiveCategorySlice = ({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) => (
  <Sector
    cx={cx}
    cy={cy}
    innerRadius={innerRadius}
    outerRadius={Number(outerRadius) + 6}
    startAngle={startAngle}
    endAngle={endAngle}
    fill={fill}
  />
)

function Dashboard() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [range, setRange] = useState('week')
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(-1)

  const handleUnauthorized = useCallback(
    (statusCode) => {
      if (statusCode === 403) {
        navigate('/pos', { replace: true })
        return true
      }

      return false
    },
    [navigate],
  )

  const fetchDashboard = useCallback(
    async (selectedRange) => {
      setLoading(true)
      setError('')

      try {
        const datePreset = dashboardRangePresetMap[selectedRange] || 'last7'
        const query = new URLSearchParams({ datePreset, salesPeriod: 'daily' }).toString()
        const response = await api.get(`/reports/dashboard?${query}`)

        setDashboardData(response)
      } catch (apiError) {
        if (handleUnauthorized(apiError?.response?.status)) return
        const message = getApiErrorMessage(apiError, 'Failed to load dashboard data')
        setError(message)
        showToast(message)
      } finally {
        setLoading(false)
      }
    },
    [handleUnauthorized, showToast],
  )

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    void fetchDashboard(range)
  }, [fetchDashboard, navigate, range])

  const rangeLabel = rangeCopy[range] || 'selected period'
  const safeKpi = {
    totalRevenue: Number(dashboardData?.kpis?.totalRevenue?.value || 0),
    totalOrders: Number(dashboardData?.kpis?.totalOrders?.value || 0),
    totalProducts: Number(dashboardData?.meta?.productCount || 0),
    lowStockCount: Number(dashboardData?.inventoryInsights?.summary?.lowStockCount || 0),
    averageOrderValue: Number(dashboardData?.kpis?.averageOrderValue?.value || 0),
  }
  const revenueComparison = Number(dashboardData?.kpis?.totalRevenue?.changePercent || 0)
  const lowStockProducts = getApiArrayData(dashboardData?.inventoryInsights?.lowStock)
  const revenueTrend = useMemo(
    () =>
      getApiArrayData(dashboardData?.salesTrend?.points).map((point) => ({
        date: point.bucketDate || point.key,
        label: point.label,
        total: Number(point.revenue || 0),
      })),
    [dashboardData],
  )
  const topProductsByRevenue = getApiArrayData(dashboardData?.topProductsByRevenue)
  const topProductsByUnits = useMemo(
    () =>
      getApiArrayData(dashboardData?.topProductsByQuantity).map((item) => ({
        ...item,
        units: Number(item.unitsSold || 0),
      })),
    [dashboardData],
  )
  const categoryDistribution = getApiArrayData(dashboardData?.categoryDistribution)
  const recentOrders = getApiArrayData(dashboardData?.recentOrders)
  const summaryCards = [
    {
      label: 'Revenue',
      value: formatCurrency(safeKpi.totalRevenue),
      helper: `Completed sales in the ${rangeLabel}`,
      icon: IndianRupee,
    },
    {
      label: 'Completed Orders',
      value: formatCount(safeKpi.totalOrders),
      helper: 'Orders that reached completed billing state',
      icon: ReceiptText,
    },
    {
      label: 'Product Master',
      value: formatCount(safeKpi.totalProducts),
      helper: 'Products currently available across the catalog',
      icon: Boxes,
    },
    {
      label: 'Low Stock Alerts',
      value: formatCount(safeKpi.lowStockCount),
      helper: 'Products at or below their stock threshold',
      icon: AlertTriangle,
    },
  ]

  const revenuePeakPoint = useMemo(() => {
    return revenueTrend.reduce((highest, item) => {
      if (!highest || Number(item.total || 0) > Number(highest.total || 0)) {
        return item
      }

      return highest
    }, null)
  }, [revenueTrend])

  const revenueChartData = useMemo(
    () =>
      [...topProductsByRevenue]
        .sort((left, right) => Number(right.revenue || 0) - Number(left.revenue || 0))
        .map((item) => ({
          ...item,
          shortName: shortenLabel(item.name, 11),
        })),
    [topProductsByRevenue],
  )

  const quantityChartData = useMemo(
    () =>
      [...topProductsByUnits]
        .sort((left, right) => Number(right.units || 0) - Number(left.units || 0))
        .map((item) => ({
          ...item,
          shortName: shortenLabel(item.name, 11),
        })),
    [topProductsByUnits],
  )

  const categoryChartData = useMemo(
    () =>
      categoryDistribution.map((item, index) => ({
        ...item,
        color: donutColors[index % donutColors.length],
      })),
    [categoryDistribution],
  )

  const totalCategoryRevenue = useMemo(
    () => categoryChartData.reduce((sum, item) => sum + Number(item.revenue || 0), 0),
    [categoryChartData],
  )

  const revenueTrendInsight = useMemo(() => {
    if (!revenuePeakPoint || Number(revenuePeakPoint.total || 0) <= 0) {
      return 'Revenue insights will appear after completed sales are available in the selected period.'
    }

    return `Revenue peaked on ${formatDate(revenuePeakPoint.date)}, the highest sales day within the selected period.`
  }, [revenuePeakPoint])

  const categoryInsight = useMemo(() => {
    if (!categoryChartData.length) return 'Category revenue insights will appear after completed sales are available.'
    return `${categoryChartData[0].category} contributes the highest share of revenue.`
  }, [categoryChartData])

  const handleExportExcel = () => {
    if (!dashboardData) {
      showToast('No dashboard data to export')
      return
    }

    const rows = []
    rows.push(['BasketIQ Business Dashboard'])
    rows.push(['Date Range', range])
    rows.push([])
    rows.push(['KPI', 'Value'])
    rows.push(['Total Revenue', safeKpi.totalRevenue])
    rows.push(['Total Orders', safeKpi.totalOrders])
    rows.push(['Total Products', safeKpi.totalProducts])
    rows.push(['Low Stock Count', safeKpi.lowStockCount])
    rows.push([])
    rows.push(['Revenue Trend'])
    rows.push(['Date', 'Revenue'])
    revenueTrend.forEach((item) => rows.push([item.date || item.label, item.total]))
    rows.push([])
    rows.push(['Category Distribution'])
    rows.push(['Category', 'Revenue', 'Percentage'])
    categoryChartData.forEach((item) => rows.push([item.category, item.revenue, item.percentage]))
    rows.push([])
    rows.push(['Product Revenue'])
    rows.push(['Product', 'Revenue'])
    revenueChartData.forEach((item) => rows.push([item.name, item.revenue]))
    rows.push([])
    rows.push(['Product Quantity Sold'])
    rows.push(['Product', 'Units Sold'])
    quantityChartData.forEach((item) => rows.push([item.name, item.units]))
    rows.push([])
    rows.push(['Recent Orders'])
    rows.push(['Invoice/Order', 'Customer', 'Amount', 'Status', 'Date'])
    recentOrders.forEach((item) => {
      rows.push([item.invoiceNumber || item.id, item.customerName, item.amount, item.status, formatDateTime(item.date)])
    })

    const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `basketiq-dashboard-${range}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Dashboard report exported', 'success')
  }

  const handleExportPdf = () => {
    window.print()
  }

  const renderRevenueTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const point = payload[0]?.payload
    return (
      <TooltipCard
        title={formatDate(point?.date)}
        value={formatCurrency(point?.total)}
        helper="Revenue"
      />
    )
  }

  const renderRevenueBarTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const point = payload[0]?.payload
    return (
      <TooltipCard
        title={point?.name || 'Product'}
        value={formatCurrency(point?.revenue)}
        helper="Revenue contribution"
      />
    )
  }

  const renderUnitsBarTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const point = payload[0]?.payload
    return (
      <TooltipCard
        title={point?.name || 'Product'}
        value={`${formatCount(point?.units)} items`}
        helper="Quantity sold"
      />
    )
  }

  const renderCategoryTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null

    const point = payload[0]?.payload
    return (
      <TooltipCard
        title={point?.category || 'Category'}
        value={formatCurrency(point?.revenue)}
        helper={`${formatPercent(point?.percentage)} of category revenue`}
      />
    )
  }

  const renderRevenueChart = () => {
    if (revenueTrend.length === 0) {
      return (
        <EmptyPanel
          compact
          title="No sales data for selected period"
          description="Complete a few orders to see revenue movement across the selected range."
        />
      )
    }

    return (
      <div className="flex flex-col">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Revenue</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{formatCurrency(safeKpi.totalRevenue)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Growth</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">
              {formatPercent(revenueComparison)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1">
          <ChartContainer className="h-[320px] min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueTrend} margin={{ top: 18, right: 20, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.secondary} stopOpacity={0.24} />
                    <stop offset="55%" stopColor={chartTheme.secondary} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={chartTheme.secondary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: chartTheme.label, fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} tick={{ fill: chartTheme.label, fontSize: 12 }} />
                <Tooltip content={renderRevenueTooltip} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="total" fill="url(#dashboardRevenueGradient)" stroke="none" isAnimationActive={false} />
                <Line type="monotone" dataKey="total" stroke={chartTheme.primary} strokeWidth={3.25} dot={false} isAnimationActive={false} activeDot={renderRevenueActiveDot} />
                {revenuePeakPoint ? (
                  <ReferenceDot x={revenuePeakPoint.label} y={revenuePeakPoint.total} r={6} fill={chartTheme.positive} stroke="#ffffff" strokeWidth={2} ifOverflow="extendDomain" />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </div>
    )
  }

  const renderCategoryChart = () => {
    if (categoryChartData.length === 0) {
      return (
        <EmptyPanel
          compact
          title="No category sales yet"
          description="Category revenue distribution will appear once completed sales are available."
        />
      )
    }

    return (
      <div className="space-y-5">
        <div className="flex justify-center pt-1">
          <ChartContainer className="h-[260px] min-h-[260px] w-full max-w-[420px] overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                <Tooltip content={renderCategoryTooltip} />
                <Pie
                  data={categoryChartData}
                  dataKey="revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={86}
                  outerRadius={108}
                  paddingAngle={2}
                  isAnimationActive={false}
                  activeIndex={activeCategoryIndex >= 0 ? activeCategoryIndex : undefined}
                  activeShape={renderActiveCategorySlice}
                  onMouseEnter={(_, index) => setActiveCategoryIndex(index)}
                  onMouseLeave={() => setActiveCategoryIndex(-1)}
                >
                  {categoryChartData.map((item) => (
                    <Cell key={item.category} fill={item.color} />
                  ))}
                </Pie>
                <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill={chartTheme.primary} fontSize="22" fontWeight="700">
                  {formatCurrency(totalCategoryRevenue)}
                </text>
                <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" fill={chartTheme.label} fontSize="12" fontWeight="600">
                  Total Revenue
                </text>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        <div className="w-full">
          {categoryChartData.map((item) => (
            <div key={item.category} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-200/80 py-3 last:border-b-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <p className="truncate text-sm font-medium text-slate-900">{item.category}</p>
              </div>
              <p className="whitespace-nowrap text-sm text-slate-700">{formatCurrency(item.revenue)}</p>
              <p className="whitespace-nowrap text-right text-sm font-semibold text-slate-900">{formatPercent(item.percentage)}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderRevenueBars = () => {
    if (revenueChartData.length === 0) {
      return (
        <EmptyPanel
          compact
          title="No product revenue data"
          description="Completed sales are required to compare product revenue."
        />
      )
    }

    return (
      <ChartContainer className="h-[300px] min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={revenueChartData} margin={{ top: 22, right: 12, left: 8, bottom: 16 }} barCategoryGap={24}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{ fill: chartTheme.label, fontSize: 12 }} interval={0} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} tick={{ fill: chartTheme.label, fontSize: 12 }} />
            <Tooltip content={renderRevenueBarTooltip} cursor={{ fill: chartTheme.hover }} />
            <Bar dataKey="revenue" radius={[12, 12, 0, 0]} fill={chartTheme.primary} maxBarSize={54} isAnimationActive={false} activeBar={{ fill: chartTheme.primarySoft }}>
              <LabelList dataKey="revenue" position="top" content={renderCurrencyBarLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    )
  }

  const renderUnitsBars = () => {
    if (quantityChartData.length === 0) {
      return (
        <EmptyPanel
          compact
          title="No product quantity data"
          description="Completed sales are required to compare units sold by product."
        />
      )
    }

    return (
      <ChartContainer className="h-[300px] min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={quantityChartData} margin={{ top: 22, right: 12, left: 8, bottom: 16 }} barCategoryGap={24}>
            <CartesianGrid stroke={chartTheme.grid} strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="shortName" axisLine={false} tickLine={false} tick={{ fill: chartTheme.label, fontSize: 12 }} interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: chartTheme.label, fontSize: 12 }} />
            <Tooltip content={renderUnitsBarTooltip} cursor={{ fill: chartTheme.hover }} />
            <Bar dataKey="units" radius={[12, 12, 0, 0]} fill={chartTheme.secondary} maxBarSize={54} isAnimationActive={false} activeBar={{ fill: chartTheme.secondarySoft }}>
              <LabelList dataKey="units" position="top" content={renderCountBarLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <ShoppingBag size={14} />
              Retail Analytics Overview
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Business Dashboard</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Track revenue movement, category contribution, product performance, and operational alerts in a cleaner BI-style retail dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[360px]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <CalendarRange size={16} />
                <select value={range} onChange={(event) => setRange(event.target.value)} className="bg-transparent font-medium text-slate-900 outline-none">
                  {rangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => void fetchDashboard(range)} className="ds-btn ds-btn-secondary">
                <RefreshCcw size={16} />
              </button>
              <button type="button" onClick={handleExportExcel} className="ds-btn ds-btn-secondary">
                <Download size={16} />
                Export Excel
              </button>
              <button type="button" onClick={handleExportPdf} className="ds-btn ds-btn-primary">
                Export PDF
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current range</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{rangeOptions.find((item) => item.value === range)?.label || 'Custom'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Revenue comparison</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatPercent(revenueComparison)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 print:hidden">
          {error}
        </section>
      ) : null}

      {loading ? (
        <>
          <section className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)]">
            <CardSkeleton rows={8} />
            <CardSkeleton rows={8} />
          </section>
          <section className="grid gap-6 xl:items-start xl:grid-cols-2">
            <CardSkeleton rows={8} />
            <CardSkeleton rows={8} />
          </section>
        </>
      ) : null}

      {!loading ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SummaryMetricCard key={card.label} {...card} />
          ))}
        </section>
      ) : null}

      {!loading ? (
        <>
          <section className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)]">
            <SectionCard
              title="Revenue Trend"
              subtitle={`Revenue collected from completed orders in the ${rangeLabel}.`}
              insight={revenueTrendInsight}
            >
              {renderRevenueChart()}
            </SectionCard>

            <SectionCard
              title="Category Distribution"
              subtitle="Revenue contribution by product category from completed sales."
              insight={categoryInsight}
            >
              {renderCategoryChart()}
            </SectionCard>
          </section>

          <section className="grid gap-6 xl:items-start xl:grid-cols-2">
            <SectionCard
              title="Product Revenue"
              subtitle="Products sorted by revenue contribution in descending order."
            >
              {renderRevenueBars()}
            </SectionCard>

            <SectionCard
              title="Product Quantity Sold"
              subtitle="Products sorted by units sold for the active dashboard range."
            >
              {renderUnitsBars()}
            </SectionCard>
          </section>
        </>
      ) : null}

      {loading ? (
        <section className="grid gap-6 xl:items-start xl:grid-cols-2">
          <CardSkeleton rows={7} />
          <CardSkeleton rows={7} />
        </section>
      ) : null}

      {!loading ? (
        <section className="grid gap-6 xl:items-start xl:grid-cols-2">
          <SectionCard
            title="Recent Orders"
            subtitle="Latest completed orders in the active dashboard range."
            actionSlot={
              <button type="button" onClick={() => navigate('/orders')} className="ds-btn ds-btn-secondary print:hidden">
                View All Orders
              </button>
            }
          >
            {recentOrders.length === 0 ? (
              <EmptyPanel
                compact
                title="No recent orders in this period"
                description="Completed orders will show up here so the team can quickly review recent billing activity."
                actionLabel="Go to POS"
                onAction={() => navigate('/pos')}
              />
            ) : (
              <div className="overflow-x-auto rounded-[24px] border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order ID</th>
                      <th className="px-3 py-3 font-semibold">Customer</th>
                      <th className="px-3 py-3 font-semibold text-right">Amount</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 font-semibold">Time / Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{order.invoiceNumber || `Order ${String(order.id).slice(-6)}`}</td>
                        <td className="px-3 py-3 text-slate-700">{order.customerName || 'Walk-in Customer'}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(order.amount)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusBadgeClass(order.status)}`}>
                            {String(order.status || 'completed').replace(/^\w/, (character) => character.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-700">{formatDateTime(order.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Low Stock Alerts"
            subtitle="Products that need replenishment attention from the inventory team."
            actionSlot={
              <button type="button" onClick={() => navigate('/inventory/low-stock')} className="ds-btn ds-btn-secondary print:hidden">
                View Inventory
              </button>
            }
          >
            {lowStockProducts.length === 0 ? (
              <EmptyPanel
                compact
                title="No low stock alerts right now"
                description="Stock alerts will appear here when product quantities fall below their reorder threshold."
              />
            ) : (
              <div className="space-y-3">
                {lowStockProducts.slice(0, 6).map((product) => {
                  const badge = getLowStockBadge(product)
                  const threshold = Number(product.reorderPoint || 10)
                  const currentStock = Number(product.stock ?? product.currentStock ?? 0)
                  const productKey = product.productId || product._id

                  return (
                    <div key={productKey} className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">{product.name}</p>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.category || 'Uncategorized'}
                          {product.sku ? ` • SKU ${product.sku}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-950">{formatCount(currentStock)}</p>
                          <p className="text-xs text-slate-500">Current stock</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-950">{formatCount(threshold)}</p>
                          <p className="text-xs text-slate-500">Threshold</p>
                        </div>
                        <button type="button" onClick={() => navigate('/inventory/low-stock')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
                          View inventory
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </section>
      ) : null}
    </div>
  )
}

export default Dashboard
