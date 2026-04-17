import { useEffect, useRef } from 'react'
import { Barcode, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../utils/invoicePdf'
import { discountTypeOptions } from './posConfig'
import { getProductStockState } from './posConfig'

function ProductDiscoveryPanel({
  loading,
  products,
  insufficientStockMode,
  searchText,
  barcodeInput,
  highlightedProductId,
  searchInputRef,
  onSearchChange,
  onSearchKeyDown,
  onBarcodeChange,
  onBarcodeKeyDown,
  onHighlightProduct,
  onAddProduct,
  cartItems,
  availableStockMap,
  onUpdateCartQuantity,
  onUpdateItemDiscount,
  onRemoveCartItem,
}) {
  const rowRefs = useRef(new Map())

  useEffect(() => {
    const highlightedRow = rowRefs.current.get(highlightedProductId)

    if (highlightedRow) {
      highlightedRow.scrollIntoView({
        block: 'nearest',
      })
    }
  }, [highlightedProductId])

  return (
    <section className="pos-panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Products</h2>
            <p className="mt-1 text-sm text-slate-500">Search or scan products and add them to the current bill.</p>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>{products.length} product(s)</span>
            <span>Stock mode: {insufficientStockMode === 'warn' ? 'Warn' : 'Block'}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
          <label className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Search</span>
            <div className="pos-icon-field">
              <Search size={16} />
              <input
                ref={searchInputRef}
                type="search"
                value={searchText}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Name, SKU, barcode, or category"
                className="pos-input"
              />
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Barcode / SKU</span>
            <div className="pos-icon-field">
              <Barcode size={16} />
              <input
                type="text"
                value={barcodeInput}
                onChange={(event) => onBarcodeChange(event.target.value)}
                onKeyDown={onBarcodeKeyDown}
                placeholder="Scan or type code"
                className="pos-input"
              />
            </div>
          </label>
        </div>
      </div>

      <div className="overflow-auto border-b border-slate-200 xl:max-h-[calc(100vh-22rem)]">
        <table className="min-w-full text-left text-sm">
          <thead className="pos-table-head">
            <tr>
              <th className="px-4 py-3 font-semibold md:px-5">Product</th>
              <th className="px-3 py-3 font-semibold">Code</th>
              <th className="px-3 py-3 font-semibold">Stock</th>
              <th className="px-3 py-3 text-right font-semibold">Price</th>
              <th className="px-3 py-3 text-right font-semibold">GST</th>
              <th className="px-4 py-3 text-right font-semibold md:px-5">Add</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => (
                <tr key={`loading-${index}`} className="pos-table-row">
                  <td colSpan={6} className="px-4 py-3 md:px-5">
                    <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
                  </td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500 md:px-5">
                  No products matched the current search or scanned code.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const stockState = getProductStockState(product)
                const isHighlighted = product._id === highlightedProductId
                const isDisabled =
                  String(product.status || 'active').toLowerCase() !== 'active' ||
                  (insufficientStockMode !== 'warn' && Number(product.stock || 0) <= 0)

                return (
                  <tr
                    key={product._id}
                    ref={(element) => {
                      if (element) {
                        rowRefs.current.set(product._id, element)
                      } else {
                        rowRefs.current.delete(product._id)
                      }
                    }}
                    onMouseEnter={() => onHighlightProduct(product._id)}
                    onClick={() => onHighlightProduct(product._id)}
                    className={`pos-table-row ${isHighlighted ? 'pos-table-row-selected' : ''}`}
                  >
                    <td className="px-4 py-3 align-middle md:px-5">
                      <div className="min-w-[220px]">
                        <p className="font-medium text-slate-950">{product.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.category || 'General'} • {product.unitType || 'unit'}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-slate-700">
                      <p className="font-medium text-slate-800">{product.sku || product.barcode || 'No code'}</p>
                      {product.sku && product.barcode ? <p className="text-xs text-slate-500">{product.barcode}</p> : null}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${stockState.className}`}>
                          {stockState.label}
                        </span>
                        <span className="text-xs text-slate-500">{Number(product.stock || 0)} available</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right align-middle font-semibold text-slate-950">
                      {formatCurrency(product.sellingPrice ?? product.price)}
                    </td>
                    <td className="px-3 py-3 text-right align-middle text-slate-700">
                      {Number(product.gstRate || 0)}%
                    </td>
                    <td className="px-4 py-3 text-right align-middle md:px-5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAddProduct(product)
                        }}
                        disabled={isDisabled}
                        className="pos-pill-btn !px-2.5 !py-1.5 text-xs"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-4 md:px-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Cart Items</h2>
            <p className="text-sm text-slate-500">Adjust quantity, discounts, or remove items before checkout.</p>
          </div>
          <p className="text-sm text-slate-500">{cartItems.length} item(s) in cart</p>
        </div>

        <div className="overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-3 py-3 font-semibold text-right">Price</th>
                <th className="px-3 py-3 font-semibold">Qty</th>
                <th className="px-3 py-3 font-semibold">Discount</th>
                <th className="px-3 py-3 font-semibold text-right">Line Total</th>
                <th className="px-4 py-3 font-semibold text-right">Remove</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No items added yet. Search or scan a product to start the bill.
                  </td>
                </tr>
              ) : (
                cartItems.map((item) => {
                  const availableStock = availableStockMap.get(item.productId) || 0
                  const exceedsStock = item.quantity > availableStock

                  return (
                    <tr key={item.productId} className="border-t border-slate-100">
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-[220px]">
                          <p className="font-medium text-slate-950">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.sku || item.barcode || 'No code'} • GST {Number(item.gstRate || 0)}%
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Stock: {availableStock}
                            {exceedsStock && insufficientStockMode === 'warn' ? ' • Above available stock' : ''}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-top font-medium text-slate-950">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => onUpdateCartQuantity(item.productId, -1)}
                            className="inline-flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-50"
                            aria-label={`Decrease quantity for ${item.name}`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="inline-flex min-w-10 items-center justify-center border-x border-slate-200 px-2 text-sm font-semibold text-slate-950">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateCartQuantity(item.productId, 1)}
                            className="inline-flex h-9 w-9 items-center justify-center text-slate-600 transition hover:bg-slate-50"
                            aria-label={`Increase quantity for ${item.name}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="grid min-w-[168px] grid-cols-[84px_minmax(0,1fr)] gap-2">
                          <select
                            value={item.discountType}
                            onChange={(event) => onUpdateItemDiscount(item.productId, 'discountType', event.target.value)}
                            className="pos-select !py-2"
                            aria-label={`Discount type for ${item.name}`}
                          >
                            {discountTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discountValue}
                            onChange={(event) => onUpdateItemDiscount(item.productId, 'discountValue', event.target.value)}
                            className="pos-input !py-2"
                            aria-label={`Discount value for ${item.name}`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-top font-semibold text-slate-950">
                        {formatCurrency(item.finalLineTotal)}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button
                          type="button"
                          onClick={() => onRemoveCartItem(item.productId)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default ProductDiscoveryPanel
