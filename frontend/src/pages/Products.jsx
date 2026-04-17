import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Pencil, Plus, Search } from 'lucide-react'
import DataTable from '../components/ui/DataTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage } from '../services/api'
import { getToken, getUserRole } from '../utils/auth'
import {
  formatCurrency,
  getCostPrice,
  getSellingPrice,
  getStatusClass,
  getStock,
  getStockStatusClass,
  getStockStatusLabel,
} from '../utils/productCatalog'

const PAGE_SIZE = 12

function Products() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const role = getUserRole()
  const isAdmin = role === 'admin'

  const [products, setProducts] = useState([])
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionProductId, setActionProductId] = useState('')

  const productList = useMemo(() => (Array.isArray(products) ? products : []), [products])

  const fetchProducts = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get('/products')
      setProducts(getApiArrayData(response))
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load products')
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

    fetchProducts()
  }, [fetchProducts, navigate])

  const categories = useMemo(
    () => [...new Set(productList.map((product) => String(product.category || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [productList],
  )

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    return productList.filter((product) => {
      const haystack = [product.name, product.sku, product.category, product.brand, product.barcode]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')

      const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch)
      const matchesCategory = !categoryFilter || String(product.category || '').toLowerCase() === categoryFilter.toLowerCase()
      const matchesStatus = !statusFilter || String(product.status || 'active').toLowerCase() === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [categoryFilter, productList, searchText, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchText, categoryFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredProducts.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, filteredProducts])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleToggleStatus = useCallback(
    async (product) => {
      if (!isAdmin) {
        showToast('Only admin can activate or deactivate products')
        return
      }

      const nextStatus = String(product.status || 'active').toLowerCase() === 'active' ? 'inactive' : 'active'
      setActionProductId(product._id)

      try {
        await api.patch(`/products/${product._id}/status`, { status: nextStatus })
        await fetchProducts()
        showToast(`Product ${nextStatus === 'active' ? 'activated' : 'deactivated'} successfully`, 'success')
      } catch (apiError) {
        showToast(getApiErrorMessage(apiError, 'Failed to update product status'))
      } finally {
        setActionProductId('')
      }
    },
    [fetchProducts, isAdmin, showToast],
  )

  const tableColumns = useMemo(
    () => [
      {
        id: 'product',
        header: 'Product Name',
        cell: (product) => (
          <div className="min-w-[220px]">
            <p className="font-medium text-slate-900">{product.name}</p>
            <p className="text-xs text-slate-500">{product.shortDescription || 'Catalog master record'}</p>
          </div>
        ),
      },
      {
        id: 'sku',
        header: 'SKU',
        cell: (product) => <span className="font-medium text-slate-700">{product.sku || 'N/A'}</span>,
      },
      {
        id: 'category',
        header: 'Category',
        cell: (product) => <span className="text-slate-700">{product.category || 'Uncategorized'}</span>,
      },
      {
        id: 'unitType',
        header: 'Unit',
        cell: (product) => <span className="text-slate-700">{product.unitType || 'unit'}</span>,
      },
      {
        id: 'brand',
        header: 'Brand',
        cell: (product) => <span className="text-slate-700">{product.brand || 'N/A'}</span>,
      },
      {
        id: 'barcode',
        header: 'Barcode',
        cell: (product) => <span className="text-slate-700">{product.barcode || 'N/A'}</span>,
      },
      {
        id: 'pricing',
        header: 'Price',
        cell: (product) => (
          <div className="space-y-1">
            <p className="text-slate-700">Cost: {formatCurrency(getCostPrice(product))}</p>
            <p className="font-medium text-slate-900">Sell: {formatCurrency(getSellingPrice(product))}</p>
          </div>
        ),
      },
      {
        id: 'gstRate',
        header: 'GST',
        cell: (product) => <span className="text-slate-700">{Number(product.gstRate || 0)}%</span>,
      },
      {
        id: 'stockSummary',
        header: 'Stock',
        cell: (product) => (
          <div className="space-y-1">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStockStatusClass(product)}`}>
              {getStockStatusLabel(product)}
            </span>
            <p className="text-xs text-slate-600">{getStock(product)} units from Inventory</p>
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: (product) => (
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getStatusClass(product.status)}`}>
            {String(product.status || 'active').toLowerCase()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: (product) => (
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/products/${product._id}`} className="ds-btn ds-btn-secondary !p-2" title="View" aria-label="View">
              <Eye size={15} />
            </Link>

            {isAdmin ? (
              <Link to={`/products/${product._id}/edit`} className="ds-btn ds-btn-secondary !p-2" title="Edit" aria-label="Edit">
                <Pencil size={15} />
              </Link>
            ) : null}

            {isAdmin ? (
              <button
                type="button"
                onClick={() => handleToggleStatus(product)}
                disabled={actionProductId === product._id}
                className="ds-btn ds-btn-secondary !px-3 !py-2 !text-xs"
              >
                {String(product.status || 'active').toLowerCase() === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    [actionProductId, handleToggleStatus, isAdmin],
  )

  const pagination = {
    page: currentPage,
    totalPages,
    totalItems: filteredProducts.length,
    startItem: filteredProducts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1,
    endItem: filteredProducts.length === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, filteredProducts.length),
    onPageChange: setCurrentPage,
  }

  return (
    <div className="space-y-5">
      <section className="ds-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
            <p className="mt-1 text-sm text-slate-500">Catalog master management for product definitions, pricing, and tax setup.</p>
          </div>

          {isAdmin ? (
            <Link to="/products/new" className="ds-btn ds-btn-primary">
              <Plus size={16} className="mr-1.5" />
              Add Product
            </Link>
          ) : null}
        </div>
      </section>

      {!isAdmin ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Staff accounts have read-only access to product master records.
        </p>
      ) : null}

      <section className="ds-card">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search name, SKU, brand, barcode"
              className="ds-input !pl-9"
            />
          </div>

          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="ds-select">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="ds-select">
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </section>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      {loading ? (
        <TableSkeleton columns={11} rows={PAGE_SIZE} />
      ) : (
        <DataTable
          columns={tableColumns}
          data={paginatedProducts}
          rowKey="_id"
          emptyState="No products found."
          pagination={pagination}
        />
      )}
    </div>
  )
}

export default Products
