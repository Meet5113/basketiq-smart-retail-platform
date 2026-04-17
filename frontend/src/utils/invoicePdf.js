import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatInvoiceDate, getInvoiceTaxRows, safeNumber } from './gstInvoice'

const DEFAULT_SHOP_ADDRESS = import.meta.env.VITE_SHOP_ADDRESS || ''
const DEFAULT_SHOP_PHONE = import.meta.env.VITE_SHOP_PHONE || ''
const DEFAULT_SHOP_EMAIL = import.meta.env.VITE_SHOP_EMAIL || ''

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

export const formatCurrency = (value) => currencyFormatter.format(safeNumber(value))

export const formatPaymentLabel = (paymentMethod) => {
  const normalized = String(paymentMethod || 'cash').toLowerCase()

  if (normalized === 'upi') return 'UPI'
  if (normalized === 'card') return 'Card'
  if (normalized === 'split') return 'Split (Cash + UPI)'
  return 'Cash'
}

export const getPaymentDescription = (invoice) => {
  const paymentMethod = String(invoice?.paymentMethod || 'cash').toLowerCase()
  const splitPayment = invoice?.splitPayment || { cashAmount: 0, upiAmount: 0 }

  if (paymentMethod !== 'split') {
    return formatPaymentLabel(paymentMethod)
  }

  return `Split - Cash ${formatCurrency(splitPayment.cashAmount)} + UPI ${formatCurrency(splitPayment.upiAmount)}`
}

const resolveSeller = ({ invoice, shopName, shopGstNumber }) => ({
  legalName: invoice?.seller?.legalName || invoice?.shop?.name || shopName || 'BasketIQ Store',
  address: invoice?.seller?.address || invoice?.shop?.address || DEFAULT_SHOP_ADDRESS || '',
  gstin: invoice?.seller?.gstin || invoice?.shop?.gstNumber || shopGstNumber || '',
  stateCode: invoice?.seller?.stateCode || invoice?.shop?.stateCode || '',
  phone: invoice?.seller?.phone || invoice?.shop?.phone || DEFAULT_SHOP_PHONE || '',
  email: invoice?.seller?.email || invoice?.shop?.email || DEFAULT_SHOP_EMAIL || '',
})

const resolveBuyer = (invoice) => ({
  legalName: invoice?.buyer?.legalName || invoice?.customer?.name || 'Walk-in Customer',
  address: invoice?.buyer?.address || invoice?.customer?.address || '',
  gstin: invoice?.buyer?.gstin || invoice?.customer?.gstin || '',
  stateCode: invoice?.buyer?.stateCode || invoice?.customer?.stateCode || '',
  phone: invoice?.buyer?.phone || invoice?.customer?.phone || '',
  email: invoice?.buyer?.email || invoice?.customer?.email || '',
})

export const getInvoiceSummaryRows = (invoice) => {
  const rows = [
    ['Subtotal', formatCurrency(invoice?.subtotal)],
    ['Item Discount', `- ${formatCurrency(invoice?.itemDiscountAmount)}`],
    ['Cart Discount', `- ${formatCurrency(invoice?.cartDiscountAmount)}`],
    ['Total Discount', `- ${formatCurrency(invoice?.discountAmount)}`],
    ['Taxable Amount', formatCurrency(invoice?.taxableAmount)],
  ]

  getInvoiceTaxRows(invoice).forEach((row) => {
    rows.push([row.label, formatCurrency(row.amount)])
  })

  rows.push(['Grand Total', formatCurrency(invoice?.finalAmount)])
  return rows
}

const getInvoiceItemRows = (invoice) =>
  (invoice?.items || []).map((item) => [
    String(item?.name || item?.description || 'Item'),
    String(item?.hsnCode || '-'),
    `${safeNumber(item?.quantity)} ${String(item?.unit || '').trim() || 'unit'}`.trim(),
    formatCurrency(item?.price ?? item?.unitPrice),
    formatCurrency(item?.taxableAmount ?? item?.finalLineTotal),
    formatCurrency(item?.taxAmount),
    formatCurrency(item?.lineAmountWithTax ?? item?.finalLineTotal),
  ])

const getTaxBreakdownRows = (invoice) =>
  (invoice?.taxBreakdown || []).map((entry) => [
    String(entry?.hsnCode || '-'),
    `${safeNumber(entry?.taxRate)}%`,
    formatCurrency(entry?.taxableAmount),
    formatCurrency(entry?.cgstAmount),
    formatCurrency(entry?.sgstAmount),
    formatCurrency(entry?.igstAmount),
    formatCurrency(entry?.taxAmount),
  ])

const getPartyDetailsHtml = (title, party) => {
  const lines = [
    `<p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">${escapeHtml(title)}</p>`,
    `<p style="margin:0 0 4px 0;font-size:13px;font-weight:700;color:#0f172a">${escapeHtml(party.legalName || 'Walk-in Customer')}</p>`,
  ]

  if (party.address) {
    lines.push(`<p style="margin:0 0 4px 0;font-size:12px;color:#475569">${escapeHtml(party.address)}</p>`)
  }
  if (party.gstin) {
    lines.push(`<p style="margin:0 0 4px 0;font-size:12px;color:#475569">GSTIN: ${escapeHtml(party.gstin)}</p>`)
  }
  if (party.stateCode) {
    lines.push(`<p style="margin:0 0 4px 0;font-size:12px;color:#475569">State Code: ${escapeHtml(party.stateCode)}</p>`)
  }
  if (party.phone) {
    lines.push(`<p style="margin:0 0 4px 0;font-size:12px;color:#475569">Phone: ${escapeHtml(party.phone)}</p>`)
  }
  if (party.email) {
    lines.push(`<p style="margin:0;font-size:12px;color:#475569">Email: ${escapeHtml(party.email)}</p>`)
  }

  return lines.join('')
}

export const buildInvoicePrintHtml = ({ invoice, shopName, shopGstNumber }) => {
  const seller = resolveSeller({ invoice, shopName, shopGstNumber })
  const buyer = resolveBuyer(invoice)
  const invoiceRows = getInvoiceItemRows(invoice)
  const taxBreakdownRows = getTaxBreakdownRows(invoice)
  const invoiceNumber = invoice?.invoiceNumber || invoice?.orderId || 'N/A'
  const summaryRows = getInvoiceSummaryRows(invoice)
  const invoiceCategory = String(invoice?.invoiceCategory || (buyer.gstin ? 'b2b' : 'b2c')).toUpperCase()
  const supplyTypeLabel = String(invoice?.supplyType || 'intra').toLowerCase() === 'inter' ? 'Inter-state' : 'Intra-state'
  const statusLabel = String(invoice?.status || 'completed')

  const itemRowsHtml = invoiceRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (col, index) =>
              `<td style="border:1px solid #d1d5db;padding:10px 8px;font-size:12px;text-align:${index >= 2 ? 'right' : 'left'}">${escapeHtml(col)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')

  const taxRowsHtml = taxBreakdownRows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (col, index) =>
              `<td style="border:1px solid #d1d5db;padding:8px;font-size:12px;text-align:${index === 0 ? 'left' : 'right'}">${escapeHtml(col)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')

  const summaryHtml = summaryRows
    .map(
      ([label, value], index) =>
        `<p style="display:flex;justify-content:space-between;margin:0;padding:${index === summaryRows.length - 1 ? '14px 16px' : '10px 0'};font-size:${index === summaryRows.length - 1 ? '17px' : '12px'};font-weight:${index === summaryRows.length - 1 ? '700' : '400'};${index === summaryRows.length - 1 ? 'border:1px solid #cbd5e1;border-radius:12px;background:#ffffff;margin-top:12px' : 'border-bottom:1px solid #e2e8f0'}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></p>`,
    )
    .join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${escapeHtml(invoiceNumber)}</title>
  </head>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;background:#f8fafc">
    <div style="max-width:980px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ea;border-radius:16px;padding:24px">
      <div style="display:flex;justify-content:space-between;gap:24px;border-bottom:1px solid #cbd5e1;padding-bottom:18px;margin-bottom:18px">
        <div style="display:flex;gap:16px;align-items:flex-start">
          <div style="width:54px;height:54px;border:1px solid #d1d5db;border-radius:14px;background:#f8fafc;display:grid;place-items:center;font-size:22px;font-weight:700;color:#334155">B</div>
          <div>
            <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#64748b">BasketIQ Smart Retail Platform</p>
            <h1 style="margin:0 0 8px 0;font-size:28px;line-height:1.2">${escapeHtml(seller.legalName)}</h1>
            ${seller.address ? `<p style="margin:0 0 4px 0;font-size:12px;color:#475569">${escapeHtml(seller.address)}</p>` : ''}
            <p style="margin:0 0 4px 0;font-size:12px;color:#475569">GSTIN: ${escapeHtml(seller.gstin || 'N/A')}</p>
            <p style="margin:0 0 4px 0;font-size:12px;color:#475569">State Code: ${escapeHtml(seller.stateCode || 'N/A')}</p>
            <p style="margin:0;font-size:12px;color:#475569">Phone: ${escapeHtml(seller.phone || 'N/A')} | Email: ${escapeHtml(seller.email || 'N/A')}</p>
          </div>
        </div>
        <div style="min-width:285px;border:1px solid #dbe2ea;border-radius:14px;background:#f8fafc;padding:14px 16px">
          <p style="margin:0 0 2px 0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">Document</p>
          <p style="margin:0 0 12px 0;font-size:22px;font-weight:700">Tax Invoice</p>
          <p style="margin:0 0 5px 0;font-size:12px">Invoice No: ${escapeHtml(invoiceNumber)}</p>
          <p style="margin:0 0 5px 0;font-size:12px">Date: ${escapeHtml(formatInvoiceDate(invoice?.createdAt || invoice?.invoiceDate))}</p>
          <p style="margin:0 0 5px 0;font-size:12px">Invoice Type: ${escapeHtml(invoiceCategory)}</p>
          <p style="margin:0 0 5px 0;font-size:12px">Supply Type: ${escapeHtml(supplyTypeLabel)}</p>
          <p style="margin:0 0 5px 0;font-size:12px">Place of Supply: ${escapeHtml(invoice?.placeOfSupply || seller.stateCode || 'N/A')}</p>
          <p style="margin:0 0 5px 0;font-size:12px">Payment: ${escapeHtml(getPaymentDescription(invoice))}</p>
          <p style="margin:0;font-size:12px">Status: ${escapeHtml(statusLabel)}</p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="border:1px solid #d1d5db;border-radius:14px;padding:14px">${getPartyDetailsHtml('Seller Details', seller)}</div>
        <div style="border:1px solid #d1d5db;border-radius:14px;padding:14px">${getPartyDetailsHtml('Buyer Details', buyer)}</div>
      </div>

      <table style="border-collapse:collapse;width:100%;margin-bottom:20px;border:1px solid #d1d5db;border-radius:14px;overflow:hidden">
        <thead>
          <tr>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:left;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Item Description</th>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:left;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">HSN/SAC</th>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Qty / Unit</th>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Unit Price</th>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Taxable Value</th>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Tax</th>
            <th style="border:1px solid #d1d5db;padding:10px 8px;background:#f1f5f9;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Line Total</th>
          </tr>
        </thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px;align-items:start">
        <div>
          ${
            taxBreakdownRows.length > 0
              ? `<h2 style="margin:0 0 10px 0;font-size:14px;font-weight:700">GST / Tax Breakdown</h2>
          <table style="border-collapse:collapse;width:100%;margin-bottom:0;border:1px solid #d1d5db;border-radius:14px;overflow:hidden">
            <thead>
              <tr>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:left;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">HSN/SAC</th>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Rate</th>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Taxable</th>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">CGST</th>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">SGST</th>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">IGST</th>
                <th style="border:1px solid #d1d5db;padding:8px;background:#f8fafc;text-align:right;font-size:11px;letter-spacing:0.14em;text-transform:uppercase">Total Tax</th>
              </tr>
            </thead>
            <tbody>${taxRowsHtml}</tbody>
          </table>`
              : `<div style="border:1px dashed #cbd5e1;border-radius:14px;background:#f8fafc;padding:16px">
            <p style="margin:0;font-size:14px;font-weight:700">GST / Tax Breakdown</p>
            <p style="margin:8px 0 0 0;font-size:12px;color:#64748b">No GST breakup is available for this invoice.</p>
          </div>`
          }

          <div style="display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:16px;margin-top:20px">
            <div style="border:1px solid #d1d5db;border-radius:14px;padding:16px">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">Invoice Notes</p>
              <p style="margin:14px 0 0 0;font-size:12px;line-height:1.7;color:#475569">This is a system-generated invoice and does not require physical signature.</p>
              <p style="margin:6px 0 0 0;font-size:12px;line-height:1.7;color:#475569">Goods once sold will be exchanged or returned only as per store policy and applicable billing terms.</p>
              <p style="margin:6px 0 0 0;font-size:12px;line-height:1.7;color:#475569">Thank you for shopping with ${escapeHtml(seller.legalName || 'BasketIQ Store')}.</p>
            </div>
            <div style="border:1px solid #d1d5db;border-radius:14px;padding:16px;text-align:center">
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">For ${escapeHtml(seller.legalName || 'BasketIQ Store')}</p>
              <div style="margin-top:44px;border-top:1px dashed #cbd5e1;padding-top:10px">
                <p style="margin:0;font-size:13px;font-weight:700">Authorized Signatory</p>
                <p style="margin:4px 0 0 0;font-size:11px;color:#64748b">System-approved retail invoice</p>
              </div>
            </div>
          </div>
        </div>

        <div style="border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;padding:16px">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">Financial Summary</p>
          <div style="margin-top:12px">${summaryHtml}</div>
          <div style="margin-top:14px;border:1px solid #cbd5e1;border-radius:12px;background:#ffffff;padding:12px 14px">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">Amount Payable</p>
            <p style="margin:6px 0 0 0;font-size:24px;font-weight:700">${escapeHtml(formatCurrency(invoice?.finalAmount))}</p>
          </div>
        </div>
      </div>

      <div style="margin-top:18px;border-top:1px solid #cbd5e1;padding-top:12px">
        <p style="margin:0;font-size:11px;line-height:1.7;color:#64748b">This is a computer-generated GST invoice for retail billing and reporting use. Keep this invoice for exchange, return, and billing reference where applicable.</p>
      </div>
    </div>
  </body>
</html>`
}

export const downloadInvoicePdf = ({ invoice, shopName, shopGstNumber }) => {
  const seller = resolveSeller({ invoice, shopName, shopGstNumber })
  const buyer = resolveBuyer(invoice)
  const invoiceNumber = invoice?.invoiceNumber || invoice?.orderId || 'N/A'
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text(seller.legalName || 'BasketIQ Store', 14, 16)
  doc.setFontSize(10)
  doc.text(`GSTIN: ${seller.gstin || 'N/A'}`, 14, 22)
  if (seller.address) {
    doc.text(`Address: ${seller.address}`, 14, 27)
  }

  doc.text(`Invoice No: ${invoiceNumber}`, 135, 16)
  doc.text(`Date: ${formatInvoiceDate(invoice?.createdAt || invoice?.invoiceDate)}`, 135, 22)
  doc.text(`Supply: ${String(invoice?.supplyType || 'intra').toLowerCase() === 'inter' ? 'Inter-state' : 'Intra-state'}`, 135, 27)
  doc.text(`Place of Supply: ${invoice?.placeOfSupply || seller.stateCode || 'N/A'}`, 135, 32)
  doc.text(`Payment: ${getPaymentDescription(invoice)}`, 14, 37)

  autoTable(doc, {
    startY: 44,
    head: [['Seller', 'Buyer']],
    body: [[
      [
        seller.legalName || 'BasketIQ Store',
        seller.address || '',
        seller.gstin ? `GSTIN: ${seller.gstin}` : '',
        seller.stateCode ? `State Code: ${seller.stateCode}` : '',
      ].filter(Boolean).join('\n'),
      [
        buyer.legalName || 'Walk-in Customer',
        buyer.address || '',
        buyer.gstin ? `GSTIN: ${buyer.gstin}` : '',
        buyer.stateCode ? `State Code: ${buyer.stateCode}` : '',
        buyer.phone ? `Phone: ${buyer.phone}` : '',
      ].filter(Boolean).join('\n'),
    ]],
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: [30, 41, 59] },
  })

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 44) + 8,
    head: [['Item', 'HSN/SAC', 'Qty / Unit', 'Unit Price', 'Taxable', 'Tax', 'Line Total']],
    body: getInvoiceItemRows(invoice),
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 41, 59] },
  })

  const taxBreakdownRows = getTaxBreakdownRows(invoice)

  if (taxBreakdownRows.length > 0) {
    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 44) + 8,
      head: [['HSN/SAC', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total Tax']],
      body: taxBreakdownRows,
      styles: { fontSize: 8.5, cellPadding: 2.2 },
      headStyles: { fillColor: [71, 85, 105] },
    })
  }

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY || 44) + 8,
    body: getInvoiceSummaryRows(invoice),
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } },
    margin: { left: 120 },
  })

  doc.save(`${String(invoiceNumber).replace(/[^\w-]/g, '_')}.pdf`)
}
