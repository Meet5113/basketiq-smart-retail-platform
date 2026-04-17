import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Ban, Eye, FileText, Printer, RefreshCw } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import { useConfirmDialog } from '../context/ConfirmDialogContext'
import { useToast } from '../context/ToastContext'
import api, { getApiErrorMessage } from '../services/api'
import { getToken } from '../utils/auth'
import {
  buildInvoicePrintHtml,
  downloadInvoicePdf,
  getInvoiceSummaryRows,
  getPaymentDescription,
} from '../utils/invoicePdf'
import {
  formatOrderCurrency,
  formatOrderDateTime,
  getCustomerDisplayName,
  getOrderStatusBadgeClass,
  getInvoiceStatusBadgeClass,
  getInvoiceStatusLabel,
  getOrderStatusLabel,
  getPaymentBadgeClass,
  getPaymentStateLabel,
} from '../utils/orderPresentation'

const SHOP_NAME = import.meta.env.VITE_SHOP_NAME || 'BasketIQ Store'
const SHOP_GST_NUMBER = import.meta.env.VITE_SHOP_GST_NUMBER || '27ABCDE1234F1Z5'

function DetailField({ label, value, subtle = false, valueClassName = '' }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className={`min-w-0 text-sm ${subtle ? 'text-slate-700' : 'font-medium text-slate-950'} ${valueClassName}`}>
        {value || 'N/A'}
      </dd>
    </div>
  )
}

function SectionCard({ title, subtitle, actionSlot, children, className = '', contentClassName = 'mt-5' }) {
  return (
    <section className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actionSlot}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  )
}

function InfoGroup({ title, subtitle, children }) {
  return (
    <section>
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <dl className="mt-4 divide-y divide-slate-200">{children}</dl>
    </section>
  )
}

function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useConfirmDialog()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [error, setError] = useState('')

  const fetchOrderInvoice = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get(`/orders/${id}/invoice`)
      setInvoice(response)
      setError('')
    } catch (apiError) {
      const message = getApiErrorMessage(apiError, 'Failed to load order details')
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [id, showToast])

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true })
      return
    }

    if (!id) {
      setError('Invalid order id.')
      setLoading(false)
      return
    }

    void fetchOrderInvoice()
  }, [fetchOrderInvoice, id, navigate])

  const summaryRows = useMemo(() => getInvoiceSummaryRows(invoice), [invoice])
  const items = Array.isArray(invoice?.items) ? invoice.items : []
  const taxBreakdown = Array.isArray(invoice?.taxBreakdown) ? invoice.taxBreakdown : []
  const isCompleted = String(invoice?.status || 'completed').toLowerCase() === 'completed'
  const orderStatusLabel = getOrderStatusLabel(invoice?.status)
  const invoiceStatusLabel = getInvoiceStatusLabel(invoice?.status, invoice?.invoiceNumber)
  const paymentDescription = getPaymentDescription(invoice)
  const paymentStateLabel = getPaymentStateLabel(invoice?.status)
  const invoiceTypeLabel = String(invoice?.invoiceCategory || 'b2c').toUpperCase()
  const supplyTypeLabel = invoice?.supplyType === 'inter' ? 'Inter-state' : 'Intra-state'
  const customerName = invoice?.customer?.name || 'Walk-in Customer'
  const customerPhone = invoice?.customer?.phone || 'N/A'
  const customerEmail = invoice?.customer?.email || 'N/A'
  const customerAddress = invoice?.customer?.address || 'N/A'
  const customerGstin = invoice?.customer?.gstin || 'N/A'
  const customerStateCode = invoice?.customer?.stateCode || 'N/A'

  const handleStatusChange = useCallback(
    async (nextStatus) => {
      if (!invoice?.orderId) return

      const shouldContinue = await confirm({
        title: `${nextStatus === 'cancelled' ? 'Cancel' : 'Refund'} ${invoice.invoiceNumber || invoice.orderId}?`,
        description:
          nextStatus === 'cancelled'
            ? 'The order will be marked as cancelled and the stock reversal will be recorded once.'
            : 'The order will be marked as refunded and the stock reversal will be recorded once.',
        confirmLabel: nextStatus === 'cancelled' ? 'Cancel order' : 'Refund order',
        cancelLabel: 'Keep order',
        tone: nextStatus === 'cancelled' ? 'warning' : 'danger',
      })

      if (!shouldContinue) {
        return
      }

      setStatusUpdating(true)

      try {
        await api.put(`/orders/${invoice.orderId}/status`, { status: nextStatus })
        showToast(`Order marked ${nextStatus}`, 'success')
        await fetchOrderInvoice()
      } catch (apiError) {
        const message = getApiErrorMessage(apiError, 'Failed to update order status')
        setError(message)
        showToast(message)
      } finally {
        setStatusUpdating(false)
      }
    },
    [confirm, fetchOrderInvoice, invoice?.invoiceNumber, invoice?.orderId, showToast],
  )

  const handlePrint = () => {
    if (!invoice) return

    const printableHtml = buildInvoicePrintHtml({
      invoice,
      shopName: invoice.shop?.name || SHOP_NAME,
      shopGstNumber: invoice.shop?.gstNumber || SHOP_GST_NUMBER,
    })

    const previewWindow = window.open('', '_blank', 'width=1100,height=760')

    if (!previewWindow) {
      showToast('Please allow popups to print the bill')
      return
    }

    previewWindow.document.write(printableHtml)
    previewWindow.document.close()
    previewWindow.focus()
    previewWindow.print()
  }

  const handleDownloadPdf = () => {
    if (!invoice) return

    downloadInvoicePdf({
      invoice,
      shopName: invoice.shop?.name || SHOP_NAME,
      shopGstNumber: invoice.shop?.gstNumber || SHOP_GST_NUMBER,
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white px-6 py-6 shadow-sm print:hidden">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              <FileText size={14} />
              Retail Order Details
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
              {invoice?.invoiceNumber || invoice?.orderId || 'Order Details'}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getOrderStatusBadgeClass(invoice?.status)}`}
              >
                Order: {orderStatusLabel}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getInvoiceStatusBadgeClass(
                  invoice?.status,
                  invoice?.invoiceNumber,
                )}`}
              >
                Invoice: {invoiceStatusLabel}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${getPaymentBadgeClass(
                  invoice?.paymentMethod,
                )}`}
              >
                {paymentDescription}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review billing, customer context, purchased items, GST summary, and invoice actions in one operational order view.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[420px] xl:items-end">
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button type="button" onClick={() => navigate('/orders')} className="ds-btn ds-btn-secondary">
                <ArrowLeft size={16} />
                Back to Orders
              </button>
              <button type="button" onClick={handlePrint} disabled={!invoice} className="ds-btn ds-btn-secondary">
                <Printer size={16} />
                Print Bill
              </button>
              <Link to={`/invoice/${id}`} className="ds-btn ds-btn-secondary">
                <Eye size={16} />
                View Invoice
              </Link>
              <button type="button" onClick={handleDownloadPdf} disabled={!invoice} className="ds-btn ds-btn-primary">
                <FileText size={16} />
                Download PDF
              </button>
            </div>

            {isCompleted ? (
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <button
                  type="button"
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Ban size={15} />
                  Cancel Order
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('refunded')}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={15} />
                  Refund Order
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </section>
      ) : null}

      {loading ? (
        <>
          <CardSkeleton rows={8} />
          <TableSkeleton columns={6} rows={6} />
        </>
      ) : null}

      {!loading && invoice ? (
        <>
          <SectionCard
            title="Order Snapshot"
            subtitle="Core transaction, customer, and billing details arranged for quick scanning."
            className="overflow-hidden"
            contentClassName="mt-6"
          >
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <div className="space-y-8 xl:border-r xl:border-slate-200 xl:pr-8">
                <InfoGroup title="Order Summary" subtitle="Transaction identifiers, status, and invoice metadata.">
                  <DetailField label="Order / Invoice" value={invoice.invoiceNumber || invoice.orderId} />
                  <DetailField label="Date & Time" value={formatOrderDateTime(invoice.createdAt)} subtle />
                  <DetailField label="Order Status" value={orderStatusLabel} />
                  <DetailField
                    label="Invoice Status"
                    value={
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getInvoiceStatusBadgeClass(
                          invoice.status,
                          invoice.invoiceNumber,
                        )}`}
                      >
                        {invoiceStatusLabel}
                      </span>
                    }
                  />
                  <DetailField label="Invoice Type" value={invoiceTypeLabel} subtle />
                </InfoGroup>

                <InfoGroup title="Customer Basics" subtitle="Saved customer snapshot captured during checkout.">
                  <DetailField label="Customer" value={customerName} />
                  <DetailField label="Phone" value={customerPhone} subtle />
                  <DetailField label="Email" value={customerEmail} subtle />
                  <DetailField label="Address" value={customerAddress} subtle valueClassName="break-words" />
                  <DetailField label="GSTIN" value={customerGstin} subtle />
                  <DetailField label="State Code" value={customerStateCode} subtle />
                </InfoGroup>
              </div>

              <div className="space-y-8">
                <InfoGroup title="Billing & Payment" subtitle="Payment state, supply context, and checkout details.">
                  <DetailField
                    label="Payment Method"
                    value={
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getPaymentBadgeClass(
                          invoice.paymentMethod,
                        )}`}
                      >
                        {paymentDescription}
                      </span>
                    }
                  />
                  <DetailField label="Payment State" value={paymentStateLabel} />
                  <DetailField label="Supply Type" value={supplyTypeLabel} subtle />
                  <DetailField label="Place of Supply" value={invoice.placeOfSupply || 'N/A'} subtle />
                </InfoGroup>

                <InfoGroup title="Commercial Snapshot" subtitle="Quick view of billing category and commercial total.">
                  <DetailField label="Customer Link" value={getCustomerDisplayName(invoice)} subtle />
                  <DetailField label="Invoice Category" value={invoiceTypeLabel} subtle />
                  <DetailField label="Final Total" value={formatOrderCurrency(invoice.finalAmount)} valueClassName="text-lg font-semibold text-slate-950" />
                </InfoGroup>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Items Purchased"
            subtitle="Product snapshot, quantity, unit price, GST, and line totals captured at sale time."
            className="overflow-hidden"
          >
            <div className="overflow-x-auto rounded-[22px] border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Item</th>
                    <th className="px-3 py-3 font-semibold">SKU / HSN</th>
                    <th className="px-3 py-3 font-semibold text-right">Quantity</th>
                    <th className="px-3 py-3 font-semibold text-right">Unit Price</th>
                    <th className="px-3 py-3 font-semibold text-right">GST %</th>
                    <th className="px-3 py-3 font-semibold text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${item.productId || item.name}-${index}`} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.unit || 'unit'}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.sku || 'N/A'}
                        <span className="block text-xs text-slate-500">{item.hsnCode || 'No HSN'}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatOrderCurrency(item.unitPrice ?? item.price)}</td>
                      <td className="px-3 py-3 text-right text-slate-700">{Number(item.taxRate || 0).toFixed(0)}%</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-900">
                        {formatOrderCurrency(item.lineAmountWithTax ?? item.finalLineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_340px]">
            <SectionCard title="GST / Tax Breakdown" subtitle="GST summary used for invoice and reporting outputs.">
              {taxBreakdown.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10">
                  <p className="text-sm font-semibold text-slate-900">No GST breakdown available</p>
                  <p className="mt-2 text-sm text-slate-500">Tax summary will appear here for taxable retail invoices.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[22px] border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">HSN / SAC</th>
                        <th className="px-3 py-3 font-semibold text-right">Rate</th>
                        <th className="px-3 py-3 font-semibold text-right">Taxable</th>
                        <th className="px-3 py-3 font-semibold text-right">CGST</th>
                        <th className="px-3 py-3 font-semibold text-right">SGST</th>
                        <th className="px-3 py-3 font-semibold text-right">IGST</th>
                        <th className="px-3 py-3 font-semibold text-right">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxBreakdown.map((entry) => (
                        <tr key={`${entry.hsnCode}-${entry.taxRate}`} className="border-t border-slate-100 bg-white hover:bg-slate-50/60">
                          <td className="px-4 py-3 text-slate-700">{entry.hsnCode || 'N/A'}</td>
                          <td className="px-3 py-3 text-right text-slate-700">{entry.taxRate}%</td>
                          <td className="px-3 py-3 text-right text-slate-700">{formatOrderCurrency(entry.taxableAmount)}</td>
                          <td className="px-3 py-3 text-right text-slate-700">{formatOrderCurrency(entry.cgstAmount)}</td>
                          <td className="px-3 py-3 text-right text-slate-700">{formatOrderCurrency(entry.sgstAmount)}</td>
                          <td className="px-3 py-3 text-right text-slate-700">{formatOrderCurrency(entry.igstAmount)}</td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatOrderCurrency(entry.taxAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Order Totals" subtitle="Compact billing summary for checkout and invoice review.">
              <div className="space-y-1 text-sm">
                {summaryRows.map(([label, value], index) => (
                  <p
                    key={label}
                    className={`flex items-center justify-between ${
                      index === summaryRows.length - 1
                        ? 'mt-3 border-t border-slate-200 pt-4 text-lg font-semibold text-slate-950'
                        : 'border-b border-slate-100 py-2 text-slate-700 last:border-b-0'
                    }`}
                  >
                    <span>{label}</span>
                    <span>{value}</span>
                  </p>
                ))}
              </div>
            </SectionCard>
          </section>
        </>
      ) : null}
    </div>
  )
}

export default OrderDetail
