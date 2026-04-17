import { useNavigate } from 'react-router-dom'
import { buildInvoicePrintHtml, downloadInvoicePdf, formatCurrency, getInvoiceSummaryRows, getPaymentDescription } from '../../utils/invoicePdf'
import { formatInvoiceDate } from '../../utils/gstInvoice'

function InvoicePreviewModal({ invoice, shopName, shopGstNumber, onClose, onError }) {
  const navigate = useNavigate()
  const previewInvoiceItems = Array.isArray(invoice?.items) ? invoice.items : []
  const previewSummaryRows = getInvoiceSummaryRows(invoice)

  const handlePrintPreview = () => {
    if (!invoice) return

    const printableHtml = buildInvoicePrintHtml({
      invoice,
      shopName,
      shopGstNumber,
    })

    const previewWindow = window.open('', '_blank', 'width=1000,height=700')

    if (!previewWindow) {
      onError?.('Please allow popups to print invoice')
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
      shopName,
      shopGstNumber,
    })
  }

  if (!invoice) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Invoice Preview</h3>
            <p className="text-xs text-slate-600">Review before sharing or printing</p>
          </div>
          <button type="button" onClick={onClose} className="ds-btn ds-btn-secondary !px-3 !py-1.5">
            Close
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-4 grid gap-4 border-b border-slate-200 pb-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div>
              <h4 className="text-lg font-bold text-slate-900">{invoice.seller?.legalName || invoice.shop?.name || shopName}</h4>
              {invoice.seller?.address ? <p className="text-sm text-slate-600">{invoice.seller.address}</p> : null}
              <p className="text-sm text-slate-600">GSTIN: {invoice.seller?.gstin || invoice.shop?.gstNumber || shopGstNumber}</p>
              {invoice.seller?.stateCode ? <p className="text-sm text-slate-600">State Code: {invoice.seller.stateCode}</p> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Invoice: {invoice.invoiceNumber || 'N/A'}</p>
              <p>Date: {formatInvoiceDate(invoice.createdAt)}</p>
              <p>Type: {String(invoice.invoiceCategory || 'b2c').toUpperCase()}</p>
              <p>Supply: {invoice.supplyType === 'inter' ? 'Inter-state' : 'Intra-state'}</p>
              <p>Place of Supply: {invoice.placeOfSupply || invoice.seller?.stateCode || 'N/A'}</p>
              <p>Payment: {getPaymentDescription(invoice)}</p>
            </div>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-900">Buyer</p>
              <p className="text-sm text-slate-700">{invoice.buyer?.legalName || invoice.customer?.name || 'Walk-in Customer'}</p>
              {invoice.buyer?.address ? <p className="text-sm text-slate-600">{invoice.buyer.address}</p> : null}
              {invoice.buyer?.gstin ? <p className="text-sm text-slate-600">GSTIN: {invoice.buyer.gstin}</p> : null}
              {invoice.buyer?.stateCode ? <p className="text-sm text-slate-600">State Code: {invoice.buyer.stateCode}</p> : null}
            </div>
            <div className="rounded-2xl border border-slate-200 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-900">Invoice Notes</p>
              <p className="text-sm text-slate-600">Customer is optional for B2C invoices.</p>
              <p className="text-sm text-slate-600">HSN/SAC and GST breakup are included below for compliance.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-slate-300 text-left text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2 font-semibold">Item</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold">HSN/SAC</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold">Qty / Unit</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold">Unit Price</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold">Taxable</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold">Tax</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {previewInvoiceItems.map((item) => (
                  <tr key={`${item.productId || item.name}-${item.hsnCode || 'hsn'}`} className="text-slate-800">
                    <td className="border border-slate-300 px-3 py-2">{item.name}</td>
                    <td className="border border-slate-300 px-3 py-2">{item.hsnCode || '-'}</td>
                    <td className="border border-slate-300 px-3 py-2">
                      {item.quantity} {item.unit || 'unit'}
                    </td>
                    <td className="border border-slate-300 px-3 py-2">{formatCurrency(item.price)}</td>
                    <td className="border border-slate-300 px-3 py-2">{formatCurrency(item.taxableAmount)}</td>
                    <td className="border border-slate-300 px-3 py-2">{formatCurrency(item.taxAmount)}</td>
                    <td className="border border-slate-300 px-3 py-2">{formatCurrency(item.lineAmountWithTax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Array.isArray(invoice.taxBreakdown) && invoice.taxBreakdown.length > 0 ? (
            <div className="mt-6 overflow-x-auto">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">GST Breakdown</h4>
              <table className="min-w-full border border-slate-300 text-left text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 font-semibold">HSN/SAC</th>
                    <th className="border border-slate-300 px-3 py-2 font-semibold">Rate</th>
                    <th className="border border-slate-300 px-3 py-2 font-semibold">Taxable</th>
                    <th className="border border-slate-300 px-3 py-2 font-semibold">CGST</th>
                    <th className="border border-slate-300 px-3 py-2 font-semibold">SGST</th>
                    <th className="border border-slate-300 px-3 py-2 font-semibold">IGST</th>
                    <th className="border border-slate-300 px-3 py-2 font-semibold">Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.taxBreakdown.map((entry) => (
                    <tr key={`${entry.hsnCode}-${entry.taxRate}`} className="text-slate-800">
                      <td className="border border-slate-300 px-3 py-2">{entry.hsnCode || '-'}</td>
                      <td className="border border-slate-300 px-3 py-2">{entry.taxRate}%</td>
                      <td className="border border-slate-300 px-3 py-2">{formatCurrency(entry.taxableAmount)}</td>
                      <td className="border border-slate-300 px-3 py-2">{formatCurrency(entry.cgstAmount)}</td>
                      <td className="border border-slate-300 px-3 py-2">{formatCurrency(entry.sgstAmount)}</td>
                      <td className="border border-slate-300 px-3 py-2">{formatCurrency(entry.igstAmount)}</td>
                      <td className="border border-slate-300 px-3 py-2">{formatCurrency(entry.taxAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-6 ml-auto w-full max-w-sm space-y-2 text-sm">
            {previewSummaryRows.map(([label, value], index) => (
              <p
                key={label}
                className={`flex items-center justify-between ${
                  index === previewSummaryRows.length - 1 ? 'border-t border-slate-300 pt-2 text-base font-bold' : ''
                }`}
              >
                <span>{label}</span>
                <span>{value}</span>
              </p>
            ))}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={handlePrintPreview} className="ds-btn ds-btn-secondary">
            Print Bill
          </button>
          <button type="button" onClick={handleDownloadPdf} className="ds-btn ds-btn-primary">
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate(`/invoice/${invoice.orderId}`)
            }}
            className="ds-btn ds-btn-secondary"
          >
            Open Invoice Page
          </button>
        </div>
      </div>
    </div>
  )
}

export default InvoicePreviewModal
