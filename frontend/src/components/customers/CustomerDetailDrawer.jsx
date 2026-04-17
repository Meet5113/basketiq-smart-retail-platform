import { ArrowUpRight, Building2, ClipboardList, ReceiptIndianRupee, Store, UserRound, X } from 'lucide-react'
import {
  formatCustomerCurrency,
  formatCustomerDate,
  formatPhoneDisplay,
  getCustomerStatusClass,
  getCustomerTypeClass,
  getCustomerTypeLabel,
  getGstStatusClass,
  getRepeatBuyerClass,
} from '../../utils/customerModule'

function InfoTile({ label, value, subtle = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${subtle ? 'text-slate-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  )
}

function CustomerDetailDrawer({
  open,
  customer,
  loading,
  onClose,
  onEdit,
  onUseInPos,
  onToggleActive,
  onViewOrders,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-slate-950/45 backdrop-blur-[2px]">
      <button type="button" aria-label="Close customer detail drawer" className="flex-1 cursor-default" onClick={onClose} />

      <aside className="h-full w-full max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700">
                <Store size={14} />
                Customer Profile
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">{customer?.name || 'Customer Detail'}</h2>
              <p className="mt-1 text-sm text-slate-500">Retail profile, billing history, and GST context for BasketIQ operations.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-[22px] bg-slate-100" />
              ))}
            </div>
          ) : !customer ? (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
              Select a customer to view retail profile details.
            </div>
          ) : (
            <>
              <section className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getCustomerTypeClass(customer.customerType)}`}>
                        {getCustomerTypeLabel(customer.customerType)}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getCustomerStatusClass(customer.isActive)}`}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getGstStatusClass(Boolean(customer.gstin))}`}>
                        {customer.gstin ? 'GST Customer' : 'Non-GST'}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRepeatBuyerClass(customer.isRepeatCustomer)}`}>
                        {customer.isRepeatCustomer ? 'Repeat Buyer' : 'New / Occasional'}
                      </span>
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">{customer.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{formatPhoneDisplay(customer.phone)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onEdit} className="ds-btn ds-btn-secondary">
                      Edit Customer
                    </button>
                    <button type="button" onClick={onUseInPos} className="ds-btn ds-btn-primary">
                      Use in POS
                    </button>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                      <UserRound size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">Profile Summary</h3>
                      <p className="mt-1 text-sm text-slate-500">Contact and customer identity at a glance.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <InfoTile label="Phone" value={formatPhoneDisplay(customer.phone)} subtle />
                    <InfoTile label="Email" value={customer.email || 'N/A'} subtle />
                    <InfoTile label="Address" value={customer.address || 'N/A'} subtle />
                    <InfoTile label="Notes" value={customer.notes || 'No staff notes added.'} subtle />
                  </div>
                </div>

                <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                      <ReceiptIndianRupee size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">Retail Insights</h3>
                      <p className="mt-1 text-sm text-slate-500">Purchase history and repeat customer visibility.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <InfoTile label="Total Spend" value={formatCustomerCurrency(customer.totalSpend)} />
                    <InfoTile label="Total Orders" value={customer.orderCount || 0} />
                    <InfoTile label="Last Purchase" value={formatCustomerDate(customer.lastPurchaseDate)} subtle />
                    <InfoTile label="Average Order Value" value={formatCustomerCurrency(customer.averageOrderValue)} subtle />
                  </div>
                </div>
              </section>

              <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">GST / Tax Info</h3>
                    <p className="mt-1 text-sm text-slate-500">Billing fields used in GST invoice behavior and interstate logic.</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <InfoTile label="Customer Type" value={getCustomerTypeLabel(customer.customerType)} subtle />
                  <InfoTile label="GSTIN" value={customer.gstin || 'N/A'} subtle />
                  <InfoTile label="State Code" value={customer.stateCode || 'N/A'} subtle />
                </div>
              </section>

              <section className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-white p-2.5 text-slate-700 shadow-sm">
                      <ClipboardList size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-950">Billing History</h3>
                      <p className="mt-1 text-sm text-slate-500">Recent customer-linked orders from POS and invoicing.</p>
                    </div>
                  </div>
                  <button type="button" onClick={onViewOrders} className="ds-btn ds-btn-secondary">
                    View Orders
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {Array.isArray(customer.recentOrders) && customer.recentOrders.length > 0 ? (
                    customer.recentOrders.map((order) => (
                      <article key={order._id} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-950">{order.invoiceNumber || order._id}</p>
                            <p className="mt-1 text-xs text-slate-500">{formatCustomerDate(order.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-950">{formatCustomerCurrency(order.finalAmount)}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{order.paymentMethod}</p>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                      No billing history linked to this customer yet.
                    </div>
                  )}
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={onToggleActive} className="ds-btn ds-btn-secondary">
                  {customer.isActive ? 'Mark Inactive' : 'Mark Active'}
                </button>
                <button type="button" onClick={onUseInPos} className="ds-btn ds-btn-primary">
                  <ArrowUpRight size={15} className="mr-1.5" />
                  Use in POS
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

export default CustomerDetailDrawer
