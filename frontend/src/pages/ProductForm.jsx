import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Boxes } from 'lucide-react'
import api, { getApiErrorMessage } from '../services/api'
import { clearAuthSession, getToken } from '../utils/auth'
import { useToast } from '../context/ToastContext'
import { formatCurrency, getMarginPercent, getUnitProfit, safeNumber } from '../utils/productCatalog'

const ALLOWED_GST_RATES = [0, 5, 12, 18, 28]

const getInitialForm = () => ({
  name: '',
  sku: '',
  category: '',
  brand: '',
  unitType: 'unit',
  barcode: '',
  costPrice: '0',
  sellingPrice: '0',
  gstRate: '0',
  status: 'active',
  shortDescription: '',
})

const normalizeOptionalText = (value, label) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be plain text.`)
  }

  const normalized = value.trim()
  return normalized || null
}

const parseNonNegativeNumberInput = (value, label) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 0
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid number.`)
  }

  if (parsed < 0) {
    throw new Error(`${label} cannot be negative.`)
  }

  return parsed
}

const buildProductPayload = (form) => {
  const gstRate = parseNonNegativeNumberInput(form.gstRate, 'GST rate')
  if (!ALLOWED_GST_RATES.includes(gstRate)) {
    throw new Error(`GST rate must be one of: ${ALLOWED_GST_RATES.join(', ')}.`)
  }

  return {
    name: String(form.name || '').trim(),
    sku: String(form.sku || '').trim().toUpperCase(),
    category: normalizeOptionalText(form.category, 'Category'),
    brand: normalizeOptionalText(form.brand, 'Brand'),
    unitType: normalizeOptionalText(form.unitType, 'Unit') || 'unit',
    barcode: normalizeOptionalText(form.barcode, 'Barcode'),
    status: form.status === 'inactive' ? 'inactive' : 'active',
    shortDescription: normalizeOptionalText(form.shortDescription, 'Short description'),
    costPrice: parseNonNegativeNumberInput(form.costPrice, 'Cost price'),
    sellingPrice: parseNonNegativeNumberInput(form.sellingPrice, 'Selling price'),
    gstRate,
  }
}

function FormField({ label, required = false, hint, children }) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </span>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </label>
  )
}

function ProductForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const { showToast } = useToast()

  const [form, setForm] = useState(getInitialForm())
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
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

  const hydrateForm = useCallback((product) => {
    setForm({
      name: String(product?.name || ''),
      sku: String(product?.sku || ''),
      category: String(product?.category || ''),
      brand: String(product?.brand || ''),
      unitType: String(product?.unitType || 'unit'),
      barcode: String(product?.barcode || ''),
      status: String(product?.status || 'active'),
      costPrice: String(safeNumber(product?.costPrice, 0)),
      sellingPrice: String(safeNumber(product?.sellingPrice ?? product?.price, 0)),
      gstRate: String(safeNumber(product?.gstRate, 0)),
      shortDescription: String(product?.shortDescription || ''),
    })
  }, [])

  useEffect(() => {
    const token = getToken()

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (!id) return

    const fetchProduct = async () => {
      setLoading(true)

      try {
        const productData = await api.get(`/products/${id}`, getAuthConfig(token))
        hydrateForm(productData)
      } catch (apiError) {
        if (handleUnauthorized(apiError?.response?.status)) return
        const message = getApiErrorMessage(apiError, 'Failed to load product data')
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [handleUnauthorized, hydrateForm, id, navigate])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const parsedProduct = useMemo(
    () => ({
      costPrice: safeNumber(form.costPrice, 0),
      sellingPrice: safeNumber(form.sellingPrice, 0),
    }),
    [form.costPrice, form.sellingPrice],
  )

  const validationMessage = useMemo(() => {
    if (!form.name.trim()) return 'Product name is required.'
    if (!form.sku.trim()) return 'SKU is required.'

    try {
      buildProductPayload(form)
    } catch (validationError) {
      return validationError?.message || 'Please review the product form.'
    }

    return ''
  }, [form])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (saving) return

    const token = getToken()

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (validationMessage) {
      setError(validationMessage)
      return
    }

    let payload

    try {
      payload = buildProductPayload(form)
    } catch (validationError) {
      setError(validationError?.message || 'Please review the product form.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const product = isEditMode
        ? await api.put(`/products/${id}`, payload, getAuthConfig(token))
        : await api.post('/products', payload, getAuthConfig(token))

      const productId = product?._id
      showToast(`Product ${isEditMode ? 'updated' : 'created'} successfully`, 'success')
      navigate(productId ? `/products/${productId}` : '/products')
    } catch (apiError) {
      if (handleUnauthorized(apiError?.response?.status)) return
      const message = getApiErrorMessage(apiError, `Failed to ${isEditMode ? 'update' : 'create'} product`)
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const profitPreview = getUnitProfit(parsedProduct)
  const marginPreview = getMarginPercent(parsedProduct)

  if (loading) {
    return <p className="text-slate-600">Loading product form...</p>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" aria-busy={saving}>
      <section className="ds-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{isEditMode ? 'Edit Product' : 'Create Product'}</h1>
            <p className="mt-1 text-sm text-slate-500">Simple product master setup for pricing, tax, and core retail identifiers.</p>
          </div>

          <Link to={isEditMode ? `/products/${id}` : '/products'} className="ds-btn ds-btn-secondary">
            <ArrowLeft size={16} className="mr-1.5" />
            Back
          </Link>
        </div>
      </section>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white p-2 text-sky-700 shadow-sm">
            <Boxes size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Stock is managed from Inventory</p>
            <p className="mt-1 text-sm text-slate-600">
              This form is only for product master setup. Use the Inventory module for stock addition, reduction, thresholds, and movement tracking.
            </p>
          </div>
        </div>
      </section>

      <section className="ds-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
          <p className="mt-1 text-sm text-slate-500">Set the master identifiers used across catalog, POS, and reporting.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Product name" required>
            <input className="ds-input" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="e.g. Parle-G 250g" required />
          </FormField>

          <FormField label="SKU" required>
            <input className="ds-input" value={form.sku} onChange={(event) => updateField('sku', event.target.value.toUpperCase())} placeholder="e.g. BIS-250-PG" required />
          </FormField>

          <FormField label="Category">
            <input className="ds-input" value={form.category} onChange={(event) => updateField('category', event.target.value)} placeholder="e.g. Biscuits" />
          </FormField>

          <FormField label="Brand">
            <input className="ds-input" value={form.brand} onChange={(event) => updateField('brand', event.target.value)} placeholder="e.g. Parle" />
          </FormField>

          <FormField label="Unit" hint="Examples: unit, pcs, box, kg, litre">
            <input className="ds-input" value={form.unitType} onChange={(event) => updateField('unitType', event.target.value)} placeholder="e.g. pcs" />
          </FormField>

          <FormField label="Barcode">
            <input className="ds-input" value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} placeholder="Scan or enter barcode" />
          </FormField>

          <FormField label="Status">
            <select value={form.status} onChange={(event) => updateField('status', event.target.value)} className="ds-select">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        </div>
      </section>

      <section className="ds-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Pricing</h2>
          <p className="mt-1 text-sm text-slate-500">Maintain clean cost and selling prices for margin tracking.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Cost price">
            <input
              type="number"
              min="0"
              step="0.01"
              className="ds-input"
              value={form.costPrice}
              onChange={(event) => updateField('costPrice', event.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField label="Selling price">
            <input
              type="number"
              min="0"
              step="0.01"
              className="ds-input"
              value={form.sellingPrice}
              onChange={(event) => updateField('sellingPrice', event.target.value)}
              placeholder="0.00"
            />
          </FormField>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Unit Profit</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(profitPreview)}</p>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Margin %</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{marginPreview.toFixed(2)}%</p>
          </article>
        </div>
      </section>

      <section className="ds-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tax</h2>
          <p className="mt-1 text-sm text-slate-500">Use standard GST slabs for simple billing and reporting.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="GST %" hint={`Allowed values: ${ALLOWED_GST_RATES.join(', ')}`}>
            <select value={form.gstRate} onChange={(event) => updateField('gstRate', event.target.value)} className="ds-select">
              {ALLOWED_GST_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </section>

      <section className="ds-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Optional Display Info</h2>
          <p className="mt-1 text-sm text-slate-500">Short catalog text for quick reference in admin views.</p>
        </div>

        <FormField label="Short description">
          <textarea
            className="ds-input min-h-[110px]"
            value={form.shortDescription}
            onChange={(event) => updateField('shortDescription', event.target.value)}
            placeholder="Optional short product note"
          />
        </FormField>
      </section>

      <section className="ds-card">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to={isEditMode ? `/products/${id}` : '/products'} className="ds-btn ds-btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="ds-btn ds-btn-primary">
            {saving ? 'Saving...' : isEditMode ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </section>
    </form>
  )
}

export default ProductForm
