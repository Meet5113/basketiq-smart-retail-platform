import { useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../context/ToastContext'
import api, { getApiArrayData, getApiErrorMessage } from '../../services/api'

const MAX_RESULTS_PER_GROUP = 4

function GlobalSearch() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const containerRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) {
        return
      }

      setIsOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const normalizedQuery = query.trim()

    if (normalizedQuery.length < 2) {
      setResults([])
      setLoading(false)
      return undefined
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true)

      try {
        const [productsResponse, ordersResponse, customersResponse] = await Promise.all([
          api.get('/products', {
            params: {
              search: normalizedQuery,
              status: 'active',
            },
          }),
          api.get('/orders'),
          api.get('/customers'),
        ])

        const lowerQuery = normalizedQuery.toLowerCase()
        const productResults = getApiArrayData(productsResponse)
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((item) => ({
            id: `product-${item._id}`,
            type: 'Product',
            title: item.name || 'Unnamed product',
            subtitle: item.sku || item.category || 'Catalog item',
            onSelect: () => navigate(`/products/${item._id}`),
          }))

        const orderResults = getApiArrayData(ordersResponse)
          .filter((item) =>
            [item.invoiceNumber, item.customerName, item.paymentMethod]
              .map((value) => String(value || '').toLowerCase())
              .join(' ')
              .includes(lowerQuery),
          )
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((item) => ({
            id: `order-${item._id}`,
            type: 'Order',
            title: item.invoiceNumber || 'Order',
            subtitle: item.customerName || 'Walk-in customer',
            onSelect: () => navigate(`/orders/${item._id}`),
          }))

        const customerResults = getApiArrayData(customersResponse)
          .filter((item) =>
            [item.name, item.phone, item.email]
              .map((value) => String(value || '').toLowerCase())
              .join(' ')
              .includes(lowerQuery),
          )
          .slice(0, MAX_RESULTS_PER_GROUP)
          .map((item) => ({
            id: `customer-${item._id}`,
            type: 'Customer',
            title: item.name || 'Customer',
            subtitle: item.phone || item.email || 'Customer record',
            onSelect: () => navigate('/customers'),
          }))

        setResults([...productResults, ...orderResults, ...customerResults])
      } catch (apiError) {
        showToast(getApiErrorMessage(apiError, 'Search is unavailable right now'))
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [navigate, query, showToast])

  const showResults = isOpen && query.trim().length >= 2
  const emptyState = !loading && showResults && results.length === 0
  const groupedResults = useMemo(() => {
    return results.reduce((accumulator, item) => {
      if (!accumulator[item.type]) {
        accumulator[item.type] = []
      }

      accumulator[item.type].push(item)
      return accumulator
    }, {})
  }, [results])

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search anything..."
          className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-10 pl-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {loading ? <LoaderCircle size={16} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-slate-400" /> : null}
      </div>

      {showResults ? (
        <div className="absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
          {Object.entries(groupedResults).map(([group, items]) => (
            <div key={group} className="border-b border-slate-100 last:border-b-0">
              <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{group}</div>
              <div className="p-2">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      item.onSelect()
                      setIsOpen(false)
                    }}
                    className="flex w-full items-start justify-between rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{item.title}</p>
                      <p className="truncate text-xs text-slate-500">{item.subtitle}</p>
                    </div>
                    <span className="ml-3 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {item.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {emptyState ? <p className="px-4 py-6 text-sm text-slate-500">No products, orders, or customers matched your search.</p> : null}
        </div>
      ) : null}
    </div>
  )
}

export default GlobalSearch
