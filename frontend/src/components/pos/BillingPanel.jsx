import { Plus, UserRound, X } from 'lucide-react'
import { formatCurrency } from '../../utils/invoicePdf'
import { discountTypeOptions, paymentMethods, supplyTypeOptions } from './posConfig'

function BillingPanel({
  customers,
  selectedCustomerId,
  selectedCustomer,
  onCustomerChange,
  onClearCustomer,
  onOpenQuickAdd,
  paymentMethod,
  onPaymentMethodChange,
  splitCashInput,
  splitUpiInput,
  onSplitCashChange,
  onSplitUpiChange,
  supplyType,
  onSupplyTypeChange,
  placeOfSupplyInput,
  onPlaceOfSupplyChange,
  cartDiscountType,
  onCartDiscountTypeChange,
  cartDiscountValue,
  onCartDiscountValueChange,
  cartItems,
  summary,
  submitting,
  onCheckout,
}) {
  const combinedDiscount = Number(summary.itemDiscountTotal || 0) + Number(summary.cartDiscountAmount || 0)
  const showInterStateSupply = supplyType === 'inter'

  return (
    <aside className="pos-panel h-fit overflow-hidden xl:sticky xl:top-4">
      <div className="border-b border-slate-200 px-4 py-4">
        <h2 className="text-base font-semibold text-slate-950">Billing</h2>
        <p className="mt-1 text-sm text-slate-500">Customer, payment, GST, and bill totals.</p>
      </div>

      <section className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Customer</h3>
            <p className="mt-1 text-xs text-slate-500">Leave blank for walk-in billing.</p>
          </div>
          <button type="button" onClick={onOpenQuickAdd} className="pos-pill-btn !px-3 !py-2 text-xs">
            <Plus size={14} />
            Add
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <select
            value={selectedCustomerId}
            onChange={(event) => onCustomerChange(event.target.value)}
            className="pos-select"
            aria-label="Select customer"
          >
            <option value="">Walk-in customer</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.name}
                {customer.phone ? ` • ${customer.phone}` : ''}
              </option>
            ))}
          </select>

          {selectedCustomer ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold text-slate-950">
                    <UserRound size={15} className="text-slate-400" />
                    <span className="truncate">{selectedCustomer.name}</span>
                  </p>
                  {selectedCustomer.phone ? <p className="mt-1">{selectedCustomer.phone}</p> : null}
                  {selectedCustomer.gstin ? <p className="mt-1">GSTIN: {selectedCustomer.gstin}</p> : null}
                  {selectedCustomer.stateCode ? <p className="mt-1">State Code: {selectedCustomer.stateCode}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={onClearCustomer}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100"
                  aria-label="Clear selected customer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="border-b border-slate-200 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-950">Payment & GST</h3>

        <div className="mt-3 space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Payment Method</span>
            <select
              value={paymentMethod}
              onChange={(event) => onPaymentMethodChange(event.target.value)}
              className="pos-select"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>

          {paymentMethod === 'split' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Cash Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitCashInput}
                  onChange={(event) => onSplitCashChange(event.target.value)}
                  className="pos-input"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">UPI Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitUpiInput}
                  onChange={(event) => onSplitUpiChange(event.target.value)}
                  className="pos-input"
                />
              </label>
            </div>
          ) : null}

          <div className="grid gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Supply Type</span>
              <select
                value={supplyType}
                onChange={(event) => onSupplyTypeChange(event.target.value)}
                className="pos-select"
              >
                {supplyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {showInterStateSupply ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Place Of Supply</span>
                <input
                  type="text"
                  value={placeOfSupplyInput}
                  onChange={(event) => onPlaceOfSupplyChange(event.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="pos-input"
                  placeholder="Enter state code"
                />
              </label>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Bill Discount</span>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                <select
                  value={cartDiscountType}
                  onChange={(event) => onCartDiscountTypeChange(event.target.value)}
                  className="pos-select"
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
                  value={cartDiscountValue}
                  onChange={(event) => onCartDiscountValueChange(event.target.value)}
                  className="pos-input"
                  placeholder="0.00"
                />
              </div>
            </label>
          </div>
        </div>
      </section>

      <section className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Bill Summary</h3>
            <p className="mt-1 text-xs text-slate-500">{cartItems.length} item(s) ready for checkout.</p>
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">INR</p>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <span>Subtotal</span>
              <span className="font-medium text-slate-950">{formatCurrency(summary.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Discount</span>
              <span className="font-medium text-slate-950">- {formatCurrency(combinedDiscount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Taxable Amount</span>
              <span className="font-medium text-slate-950">{formatCurrency(summary.taxableAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>CGST</span>
              <span className="font-medium text-slate-950">{formatCurrency(summary.cgstAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>SGST</span>
              <span className="font-medium text-slate-950">{formatCurrency(summary.sgstAmount)}</span>
            </div>
            {showInterStateSupply ? (
              <div className="flex items-center justify-between gap-3">
                <span>IGST</span>
                <span className="font-medium text-slate-950">{formatCurrency(summary.igstAmount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span>Total Tax</span>
              <span className="font-medium text-slate-950">{formatCurrency(summary.gstAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-base">
              <span className="font-semibold text-slate-950">Final Total</span>
              <span className="font-semibold text-slate-950">{formatCurrency(summary.finalAmount)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={submitting}
          className="pos-primary-btn mt-4 w-full justify-center"
        >
          {submitting ? 'Generating Bill...' : 'Generate Bill'}
        </button>
      </section>
    </aside>
  )
}

export default BillingPanel
