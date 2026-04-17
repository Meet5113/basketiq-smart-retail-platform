export const formatOrderCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

export const formatOrderCount = (value) => new Intl.NumberFormat('en-IN').format(Number(value || 0))

export const formatOrderDateTime = (value) => {
  if (!value) return 'N/A'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'N/A'

  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const getOrderStatusLabel = (status) => {
  const normalized = String(status || 'completed').toLowerCase()
  if (normalized === 'cancelled') return 'Cancelled'
  if (normalized === 'refunded') return 'Refunded'
  return 'Completed'
}

export const getOrderStatusBadgeClass = (status) => {
  const normalized = String(status || 'completed').toLowerCase()
  if (normalized === 'cancelled') return 'bg-amber-100 text-amber-700 ring-amber-200'
  if (normalized === 'refunded') return 'bg-rose-100 text-rose-700 ring-rose-200'
  return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
}

export const getInvoiceStatusLabel = (status, invoiceNumber) => {
  const normalized = String(status || 'completed').toLowerCase()
  if (!invoiceNumber) return 'Pending'
  if (normalized === 'cancelled') return 'Voided'
  if (normalized === 'refunded') return 'Refunded'
  return 'Issued'
}

export const getInvoiceStatusBadgeClass = (status, invoiceNumber) => {
  const normalized = String(status || 'completed').toLowerCase()
  if (!invoiceNumber) return 'bg-slate-100 text-slate-700 ring-slate-200'
  if (normalized === 'cancelled') return 'bg-amber-100 text-amber-700 ring-amber-200'
  if (normalized === 'refunded') return 'bg-rose-100 text-rose-700 ring-rose-200'
  return 'bg-sky-100 text-sky-700 ring-sky-200'
}

export const getPaymentMethodLabel = (order = {}) => {
  const paymentMethod = String(order?.paymentMethod || 'cash').toLowerCase()

  if (paymentMethod === 'upi') return 'UPI'
  if (paymentMethod === 'card') return 'Card'
  if (paymentMethod === 'split' || paymentMethod === 'mixed') {
    const cashAmount = Number(order?.splitPayment?.cashAmount || 0)
    const upiAmount = Number(order?.splitPayment?.upiAmount || 0)
    const parts = []

    if (cashAmount > 0) parts.push(`Cash ${formatOrderCurrency(cashAmount)}`)
    if (upiAmount > 0) parts.push(`UPI ${formatOrderCurrency(upiAmount)}`)

    return parts.length > 0 ? `Mixed (${parts.join(' + ')})` : 'Mixed'
  }

  return 'Cash'
}

export const getPaymentBadgeClass = (paymentMethod) => {
  const normalized = String(paymentMethod || 'cash').toLowerCase()
  if (normalized === 'upi') return 'bg-violet-100 text-violet-700 ring-violet-200'
  if (normalized === 'card') return 'bg-indigo-100 text-indigo-700 ring-indigo-200'
  if (normalized === 'split' || normalized === 'mixed') return 'bg-teal-100 text-teal-700 ring-teal-200'
  return 'bg-sky-100 text-sky-700 ring-sky-200'
}

export const getPaymentStateLabel = (status) => {
  const normalized = String(status || 'completed').toLowerCase()
  if (normalized === 'refunded') return 'Refunded'
  return 'Paid'
}

export const getCustomerDisplayName = (order = {}) => order?.customerName || order?.customer?.name || order?.buyer?.legalName || 'Walk-in Customer'

export const isWalkInOrder = (order = {}) => !order?.customerId && !order?.customer?.id
