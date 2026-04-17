import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, FileText, Mail, Phone, ReceiptText, Store } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api, { getApiErrorMessage } from '../services/api'
import { clearAuthSession, getToken } from '../utils/auth'
import { useToast } from '../context/ToastContext'
import {
  buildInvoicePrintHtml,
  downloadInvoicePdf,
  formatCurrency,
  getInvoiceSummaryRows,
  getPaymentDescription,
} from '../utils/invoicePdf'
import { formatInvoiceDate } from '../utils/gstInvoice'

const SHOP_NAME = import.meta.env.VITE_SHOP_NAME || 'BasketIQ Store'
const SHOP_GST_NUMBER = import.meta.env.VITE_SHOP_GST_NUMBER || '27ABCDE1234F1Z5'
const SHOP_ADDRESS = import.meta.env.VITE_SHOP_ADDRESS || ''
const SHOP_PHONE = import.meta.env.VITE_SHOP_PHONE || ''
const SHOP_EMAIL = import.meta.env.VITE_SHOP_EMAIL || ''

function InfoRow({ label, value, strong = false, className = '' }) {
  return (
    <div className={`grid gap-1 py-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4 ${className}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className={`min-w-0 text-sm ${strong ? 'font-semibold text-slate-950' : 'text-slate-700'}`}>{value || 'N/A'}</dd>
    </div>
  )
}

function Invoice() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [invoice, setInvoice] = useState(null)
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

  const fetchInvoice = useCallback(
    async (token) => {
      setLoading(true)

      try {
        const invoiceData = await api.get(`/orders/${id}/invoice`, getAuthConfig(token))
        setInvoice(invoiceData)
        setError('')
      } catch (apiError) {
        if (handleUnauthorized(apiError?.response?.status)) return
        const message = getApiErrorMessage(apiError, 'Failed to load invoice')
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
      setError('Invalid invoice id.')
      setLoading(false)
      return
    }

    fetchInvoice(token)
  }, [fetchInvoice, id, navigate])

  const summaryRows = useMemo(() => getInvoiceSummaryRows(invoice), [invoice])
  const invoiceDate = useMemo(() => formatInvoiceDate(invoice?.createdAt), [invoice])
  const sellerName = invoice?.seller?.legalName || invoice?.shop?.name || SHOP_NAME
  const sellerAddress = invoice?.seller?.address || invoice?.shop?.address || SHOP_ADDRESS || 'Address not available'
  const sellerGstin = invoice?.seller?.gstin || invoice?.shop?.gstNumber || SHOP_GST_NUMBER
  const sellerStateCode = invoice?.seller?.stateCode || invoice?.shop?.stateCode || 'N/A'
  const sellerPhone = invoice?.seller?.phone || invoice?.shop?.phone || SHOP_PHONE || 'N/A'
  const sellerEmail = invoice?.seller?.email || invoice?.shop?.email || SHOP_EMAIL || 'N/A'
  const buyerName = invoice?.buyer?.legalName || invoice?.customer?.name || 'Walk-in Customer'
  const buyerAddress = invoice?.buyer?.address || invoice?.customer?.address || 'N/A'
  const buyerGstin = invoice?.buyer?.gstin || invoice?.customer?.gstin || 'N/A'
  const buyerStateCode = invoice?.buyer?.stateCode || invoice?.customer?.stateCode || 'N/A'
  const buyerPhone = invoice?.buyer?.phone || invoice?.customer?.phone || 'N/A'
  const buyerEmail = invoice?.buyer?.email || invoice?.customer?.email || 'N/A'
  const invoiceNumber = invoice?.invoiceNumber || invoice?.orderId || 'N/A'
  const invoiceType = String(invoice?.invoiceCategory || 'b2c').toUpperCase()
  const supplyType = invoice?.supplyType === 'inter' ? 'Inter-state' : 'Intra-state'
  const invoiceStatus = String(invoice?.status || 'completed')

  const handlePrint = () => {
    if (!invoice) return

    const printableHtml = buildInvoicePrintHtml({
      invoice,
      shopName: invoice.shop?.name || SHOP_NAME,
      shopGstNumber: invoice.shop?.gstNumber || SHOP_GST_NUMBER,
    })

    const previewWindow = window.open('', '_blank', 'width=1100,height=760')

    if (!previewWindow) {
      showToast('Please allow popups to print invoice')
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
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h2 className="ds-page-title">GST Invoice</h2>
          <p className="mt-1 text-sm text-slate-500">Review and print a GST-ready retail invoice document.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/pos" className="ds-btn ds-btn-secondary">
            Back to POS
          </Link>
          <button type="button" onClick={handlePrint} className="ds-btn ds-btn-secondary">
            Print Invoice
          </button>
          <button type="button" onClick={handleDownloadPdf} className="ds-btn ds-btn-primary">
            Download PDF
          </button>
        </div>
      </div>

      {error ? <p className="mb-4 text-sm font-medium text-red-600 print:hidden">{error}</p> : null}
      {loading ? <p className="text-slate-600 print:hidden">Loading invoice...</p> : null}

      {!loading && invoice ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-sm ring-1 ring-slate-200 print:rounded-none print:border-0 print:p-0 print:shadow-none print:ring-0">
          <div className="border-b border-slate-300 pb-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="flex gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <Store size={28} className="text-slate-700" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">BasketIQ Smart Retail Platform</p>
                  <h1 className="mt-1 text-[30px] font-semibold tracking-tight text-slate-950">{sellerName}</h1>
                  <div className="mt-3 grid gap-1.5 text-sm text-slate-600">
                    <p className="flex items-start gap-2">
                      <Building2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <span className="break-words">{sellerAddress}</span>
                    </p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-medium text-slate-900">GSTIN: {sellerGstin}</span>
                      <span className="text-slate-600">State Code: {sellerStateCode}</span>
                    </p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400" />
                        {sellerPhone}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={14} className="text-slate-400" />
                        {sellerEmail}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Document</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">Tax Invoice</h2>
                  </div>
                  <ReceiptText size={22} className="text-slate-400" />
                </div>
                <dl className="mt-4 divide-y divide-slate-200">
                  <InfoRow label="Invoice No." value={invoiceNumber} strong />
                  <InfoRow label="Date" value={invoiceDate} />
                  <InfoRow label="Invoice Type" value={invoiceType} />
                  <InfoRow label="Supply Type" value={supplyType} />
                  <InfoRow label="Place Of Supply" value={invoice.placeOfSupply || sellerStateCode || 'N/A'} />
                  <InfoRow label="Payment" value={getPaymentDescription(invoice)} />
                  <InfoRow label="Status" value={invoiceStatus} />
                </dl>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seller Details</p>
              <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">{sellerName}</p>
                <p>{sellerAddress}</p>
                <p>GSTIN: {sellerGstin}</p>
                <p>State Code: {sellerStateCode}</p>
                <p>Phone: {sellerPhone}</p>
                <p>Email: {sellerEmail}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Buyer Details</p>
              <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                <p className="font-semibold text-slate-950">{buyerName}</p>
                <p>{buyerAddress}</p>
                <p>GSTIN: {buyerGstin}</p>
                <p>State Code: {buyerStateCode}</p>
                <p>Phone: {buyerPhone}</p>
                <p>Email: {buyerEmail}</p>
              </div>
            </section>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-300">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100">
                <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-600">
                  <th className="border-b border-slate-300 px-4 py-3 font-semibold">Item Description</th>
                  <th className="border-b border-slate-300 px-3 py-3 font-semibold">HSN/SAC</th>
                  <th className="border-b border-slate-300 px-3 py-3 font-semibold text-right">Qty / Unit</th>
                  <th className="border-b border-slate-300 px-3 py-3 font-semibold text-right">Unit Price</th>
                  <th className="border-b border-slate-300 px-3 py-3 font-semibold text-right">Taxable Value</th>
                  <th className="border-b border-slate-300 px-3 py-3 font-semibold text-right">Tax</th>
                  <th className="border-b border-slate-300 px-4 py-3 font-semibold text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(invoice.items) ? invoice.items : []).map((item, index) => (
                  <tr key={`${item.productId || item.name}-${item.hsnCode || 'hsn'}-${index}`} className="border-t border-slate-200 text-slate-800">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.unit || 'unit'}</p>
                    </td>
                    <td className="px-3 py-3">{item.hsnCode || '-'}</td>
                    <td className="px-3 py-3 text-right">
                      {item.quantity} {item.unit || 'unit'}
                    </td>
                    <td className="px-3 py-3 text-right">{formatCurrency(item.price)}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(item.taxableAmount)}</td>
                    <td className="px-3 py-3 text-right">{formatCurrency(item.taxAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(item.lineAmountWithTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              {Array.isArray(invoice.taxBreakdown) && invoice.taxBreakdown.length > 0 ? (
                <section className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">GST / Tax Breakdown</h3>
                      <p className="mt-1 text-sm text-slate-500">Tax summary aligned to HSN/SAC and rate slabs.</p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50">
                        <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-600">
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold">HSN/SAC</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold text-right">Rate</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold text-right">Taxable</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold text-right">CGST</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold text-right">SGST</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold text-right">IGST</th>
                          <th className="border-b border-slate-200 px-3 py-3 font-semibold text-right">Total Tax</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.taxBreakdown.map((entry) => (
                          <tr key={`${entry.hsnCode}-${entry.taxRate}`} className="border-t border-slate-100 text-slate-800">
                            <td className="px-3 py-3">{entry.hsnCode || '-'}</td>
                            <td className="px-3 py-3 text-right">{entry.taxRate}%</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(entry.taxableAmount)}</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(entry.cgstAmount)}</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(entry.sgstAmount)}</td>
                            <td className="px-3 py-3 text-right">{formatCurrency(entry.igstAmount)}</td>
                            <td className="px-3 py-3 text-right font-semibold text-slate-950">{formatCurrency(entry.taxAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
                  <h3 className="text-base font-semibold text-slate-950">GST / Tax Breakdown</h3>
                  <p className="mt-2 text-sm text-slate-500">No GST breakup is available for this invoice.</p>
                </section>
              )}

              <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Remarks</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <p>This is a system-generated invoice and does not require physical signature.</p>
                    <p>Goods once sold will be exchanged or returned only as per store policy and applicable billing terms.</p>
                    <p>Payment has been recorded against this invoice through the selected retail payment method.</p>
                    <p>Thank you for shopping with BasketIQ Store.</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">For {sellerName}</p>
                  <div className="mt-10 border-t border-dashed border-slate-300 pt-3">
                    <p className="text-sm font-semibold text-slate-900">Authorized Signatory</p>
                    <p className="mt-1 text-xs text-slate-500">System-approved retail invoice</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="rounded-2xl border border-slate-300 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Financial Summary</p>
              <div className="mt-4 space-y-1">
                {summaryRows.map(([label, value], index) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between ${
                      index === summaryRows.length - 1
                        ? 'mt-4 rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-950 shadow-sm'
                        : 'border-b border-slate-200 py-2.5 text-sm text-slate-700'
                    }`}
                  >
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Amount Payable</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{formatCurrency(invoice.finalAmount)}</p>
              </div>
            </aside>
          </div>

          <footer className="mt-6 border-t border-slate-300 pt-4 text-xs leading-5 text-slate-500">
            <p className="font-semibold uppercase tracking-[0.16em] text-slate-600">Invoice Notes</p>
            <p className="mt-2">This is a computer-generated tax invoice for retail billing and GST reporting purposes.</p>
            <p>Keep this invoice for exchange, return, and warranty reference where applicable. Contact the store for billing support if any correction is required.</p>
          </footer>
        </section>
      ) : null}
    </>
  )
}

export default Invoice
