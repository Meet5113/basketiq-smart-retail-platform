import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes, Edit, History } from 'lucide-react'
import api, { getApiErrorMessage } from '../services/api'
import { clearAuthSession, getToken, getUserRole } from '../utils/auth'
import { useToast } from '../context/ToastContext'
import { formatDateTime, getStockMovementClass, getStockMovementLabel } from '../utils/inventoryModule'
import {
  formatCurrency,
  getCostPrice,
  getMarginPercent,
  getSellingPrice,
  getStatusClass,
  getStock,
  getStockStatusClass,
  getStockStatusLabel,
  getStockThreshold,
  getUnitProfit,
} from '../utils/productCatalog'

function InfoField({ label, value, helper, subtle = false }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={subtle ? 'text-sm font-medium text-slate-700' : 'text-sm font-semibold text-slate-900'}>{value}</p>
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

function SummaryStat({ label, value, helper, tone = 'default' }) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : 'text-slate-900'

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
      {helper ? <p className="text-sm text-slate-600">{helper}</p> : null}
    </div>
  )
}

function Panel({ title, subtitle, children }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      {children}
    </article>
  )
}

function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const role = getUserRole()
  const isAdmin = role === 'admin'

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const getAuthConfig = (token) => ({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const handleUnauthorized = useCallback(
    (statusCode) => {
      if (statusCode === 401) {
        clearAuthSession()
        navigate('/login', { replace: true })
        return true
      }

      return false
    },
    [navigate],
  )

  const fetchProductDetail = useCallback(
    async (token) => {
      setLoading(true)

      try {
        const productData = await api.get(`/products/${id}`, getAuthConfig(token))
        setProduct(productData || null)
        setError('')
      } catch (apiError) {
        if (handleUnauthorized(apiError?.response?.status)) return
        const message = getApiErrorMessage(apiError, 'Failed to load product details')
        setError(message)
        showToast(message)
      } finally {
        setLoading(false)
      }
    },
    [handleUnauthorized, id, showToast],
  )

  useEffect(() => {
    const token = getToken()

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (!id) {
      setError('Invalid product id.')
      setLoading(false)
      return
    }

    fetchProductDetail(token)
  }, [fetchProductDetail, id, navigate])

  const summary = useMemo(() => {
    const safeProduct = product || {}
    const inventoryLogs = Array.isArray(safeProduct.inventoryLogs) ? safeProduct.inventoryLogs : []
    const latestMovement = inventoryLogs[0] || null
    const stockThreshold = getStockThreshold({
      reorderPoint: safeProduct?.inventoryInsights?.reorderPoint ?? safeProduct?.reorderPoint,
    })

    return {
      sellingPrice: getSellingPrice(safeProduct),
      costPrice: getCostPrice(safeProduct),
      unitProfit: getUnitProfit(safeProduct),
      marginPercent: getMarginPercent(safeProduct),
      stock: getStock(safeProduct),
      stockThreshold,
      inventoryValue: Number(safeProduct?.inventoryInsights?.inventoryValue || 0),
      totalSoldUnits: Number(safeProduct?.totalSoldUnits || 0),
      revenueGenerated: Number(safeProduct?.revenueGenerated || 0),
      latestMovement,
      lastStockUpdate: latestMovement?.date || safeProduct?.updatedAt || null,
      movementCount: inventoryLogs.length,
      inboundMovements: inventoryLogs.filter((entry) => Number(entry?.changeQty || 0) > 0).length,
      outboundMovements: inventoryLogs.filter((entry) => Number(entry?.changeQty || 0) < 0).length,
      adjustmentMovements: inventoryLogs.filter((entry) => String(entry?.type || '').toUpperCase() === 'ADJUSTMENT').length,
    }
  }, [product])

  const productReadinessLabel = useMemo(() => {
    const masterStatus = String(product?.status || 'active').toLowerCase()
    const stockStatus = getStockStatusLabel(product)

    if (masterStatus !== 'active') {
      return 'Inactive in product master'
    }

    if (stockStatus === 'Out of Stock') {
      return 'Active but not currently sellable'
    }

    if (stockStatus === 'Low Stock') {
      return 'Active with stock risk'
    }

    return 'Active and ready for sale'
  }, [product])

  if (loading) {
    return <p className="text-slate-600">Loading product details...</p>
  }

  if (!loading && !product) {
    return (
      <div className="space-y-5">
        <section className="ds-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Product Detail</h1>
              <p className="mt-1 text-sm text-slate-500">Business review page for product master data and live inventory visibility.</p>
            </div>
            <Link to="/products" className="ds-btn ds-btn-secondary">
              <ArrowLeft size={16} className="mr-1.5" />
              Back to Products
            </Link>
          </div>
        </section>

        {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

        <section className="ds-card">
          <p className="text-slate-600">No data available.</p>
        </section>
      </div>
    )
  }

  const stockRiskTone = summary.stock <= summary.stockThreshold ? 'warning' : 'default'

  return (
    <div className="space-y-5">
      <section className="ds-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Product Detail</h1>
            <p className="mt-1 text-sm text-slate-500">Business review page for product master data and live inventory visibility.</p>
          </div>
          <Link to="/products" className="ds-btn ds-btn-secondary">
            <ArrowLeft size={16} className="mr-1.5" />
            Back to Products
          </Link>
        </div>
      </section>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClass(product.status)}`}>
                {String(product.status || 'active').toLowerCase()}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStockStatusClass(product)}`}>
                {getStockStatusLabel(product)}
              </span>
            </div>

            <div>
              <h2 className="text-3xl font-semibold text-slate-900">{product.name}</h2>
              <p className="mt-2 text-sm text-slate-500">
                SKU {product.sku || 'N/A'} • {product.category || 'Uncategorized'} • Unit {product.unitType || 'unit'}
              </p>
              {product.shortDescription ? <p className="mt-3 max-w-3xl text-sm text-slate-600">{product.shortDescription}</p> : null}
            </div>

            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-slate-200 px-4 py-4 sm:border-r xl:border-b-0">
                <SummaryStat label="Current Stock" value={summary.stock} helper={`Threshold ${summary.stockThreshold}`} tone={stockRiskTone} />
              </div>
              <div className="border-b border-slate-200 px-4 py-4 xl:border-b-0 xl:border-r">
                <SummaryStat
                  label="Selling Price"
                  value={formatCurrency(summary.sellingPrice)}
                  helper={`Cost ${formatCurrency(summary.costPrice)}`}
                  tone="success"
                />
              </div>
              <div className="border-b border-slate-200 px-4 py-4 sm:border-r sm:border-slate-200 xl:border-b-0">
                <SummaryStat
                  label="Inventory Value"
                  value={formatCurrency(summary.inventoryValue)}
                  helper={`${summary.stock} ${product.unitType || 'unit'} in stock`}
                />
              </div>
              <div className="px-4 py-4">
                <SummaryStat
                  label="Last Stock Update"
                  value={formatDateTime(summary.lastStockUpdate)}
                  helper={summary.latestMovement ? getStockMovementLabel(summary.latestMovement.type) : 'No stock movements yet'}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[320px] xl:grid-cols-1">
            {isAdmin ? (
              <Link to={`/products/${product._id}/edit`} className="ds-btn ds-btn-secondary w-full justify-center">
                <Edit size={16} className="mr-1.5" />
                Edit Product
              </Link>
            ) : null}
            <Link to={`/inventory?productId=${product._id}`} className="ds-btn ds-btn-primary w-full justify-center">
              <Boxes size={16} className="mr-1.5" />
              Manage Inventory
            </Link>
            <Link to={`/inventory/history?productId=${product._id}`} className="ds-btn ds-btn-secondary w-full justify-center">
              <History size={16} className="mr-1.5" />
              View Stock History
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Product Information" subtitle="Core product master identifiers for retail operations.">
          <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">
            <InfoField label="Name" value={product.name || 'N/A'} />
            <InfoField label="SKU" value={product.sku || 'N/A'} subtle />
            <InfoField label="Category" value={product.category || 'Uncategorized'} subtle />
            <InfoField label="Barcode" value={product.barcode || 'Not assigned'} subtle />
            <InfoField label="Unit" value={product.unitType || 'unit'} subtle />
            <InfoField label="Brand" value={product.brand || 'Not specified'} subtle />
          </div>
        </Panel>

        <Panel title="Pricing and Tax" subtitle="Commercial pricing inputs and margin visibility.">
          <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2">
            <InfoField label="Cost Price" value={formatCurrency(summary.costPrice)} subtle />
            <InfoField label="Selling Price" value={formatCurrency(summary.sellingPrice)} />
            <InfoField label="GST Rate" value={`${Number(product.gstRate || 0)}%`} subtle />
            <InfoField label="Unit Profit" value={formatCurrency(summary.unitProfit)} helper={`Margin ${summary.marginPercent.toFixed(2)}%`} />
          </div>
        </Panel>

        <Panel title="Inventory Summary" subtitle="Current stock position and threshold monitoring.">
          <div className="mt-5 grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:grid-cols-2">
            <div className="border-b border-slate-200 px-4 py-4 md:border-r">
              <SummaryStat label="Current Stock" value={summary.stock} helper={`Unit ${product.unitType || 'unit'}`} tone={stockRiskTone} />
            </div>
            <div className="border-b border-slate-200 px-4 py-4">
              <SummaryStat label="Low Stock Threshold" value={summary.stockThreshold} helper="Managed from the Inventory module" />
            </div>
            <div className="border-b border-slate-200 px-4 py-4 md:border-b-0 md:border-r">
              <SummaryStat label="Inventory Value" value={formatCurrency(summary.inventoryValue)} helper="Current stock × cost price" />
            </div>
            <div className="px-4 py-4">
              <SummaryStat
                label="Last Stock Update"
                value={formatDateTime(summary.lastStockUpdate)}
                helper={summary.latestMovement?.reason || summary.latestMovement?.note || 'No stock adjustments yet'}
              />
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClass(product.status)}`}>
                Master: {String(product.status || 'active').toLowerCase()}
              </span>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStockStatusClass(product)}`}>
                Stock: {getStockStatusLabel(product)}
              </span>
            </div>

            <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
              <InfoField label="Last Master Update" value={formatDateTime(product.updatedAt)} subtle />
              <InfoField label="Business Readiness" value={productReadinessLabel} helper={product.shortDescription || ''} subtle />
            </div>
          </div>
        </Panel>

        <Panel title="Movement Summary" subtitle="Quick audit view of movement volume and recent stock activity.">
          <div className="mt-5 grid overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 md:grid-cols-2">
            <div className="border-b border-slate-200 px-4 py-4 md:border-r">
              <SummaryStat label="Movement Entries" value={summary.movementCount} helper="Latest first in stock history" />
            </div>
            <div className="border-b border-slate-200 px-4 py-4">
              <SummaryStat label="Units Sold" value={summary.totalSoldUnits} helper={`Revenue ${formatCurrency(summary.revenueGenerated)}`} />
            </div>
            <div className="border-b border-slate-200 px-4 py-4 md:border-b-0 md:border-r">
              <SummaryStat label="Inbound Movements" value={summary.inboundMovements} />
            </div>
            <div className="px-4 py-4">
              <SummaryStat label="Outbound Movements" value={summary.outboundMovements} helper={`Adjustments ${summary.adjustmentMovements}`} />
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Latest movement</p>
              {summary.latestMovement ? (
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${getStockMovementClass(
                    summary.latestMovement.type,
                  )}`}
                >
                  {getStockMovementLabel(summary.latestMovement.type)}
                </span>
              ) : null}
            </div>

            {summary.latestMovement ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                  <InfoField label="When" value={formatDateTime(summary.latestMovement.date)} subtle />
                  <InfoField
                    label="Stock Change"
                    value={`${Number(summary.latestMovement.changeQty || 0) > 0 ? '+' : ''}${summary.latestMovement.changeQty} (${summary.latestMovement.beforeQty} to ${summary.latestMovement.afterQty})`}
                    subtle
                  />
                  <InfoField label="Reason" value={summary.latestMovement.reason || summary.latestMovement.note || 'No reason provided'} subtle />
                  <InfoField label="User" value={summary.latestMovement.performedByName || 'System'} subtle />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No stock movements have been recorded for this product yet.</p>
            )}
          </div>
        </Panel>
      </section>
    </div>
  )
}

export default ProductDetail
