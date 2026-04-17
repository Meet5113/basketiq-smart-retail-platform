export const formatDateTime = (value) => {
  if (!value) return 'N/A'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleString()
}

export const getInventoryStatusClass = (stockStatus) => {
  const normalized = String(stockStatus || '').toLowerCase()

  if (normalized === 'out of stock') {
    return 'bg-red-100 text-red-700 ring-red-200'
  }

  if (normalized === 'low stock') {
    return 'bg-amber-100 text-amber-700 ring-amber-200'
  }

  return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
}

export const getStockActionTitle = (action) => {
  if (action === 'reduce') return 'Reduce Stock'
  if (action === 'adjust') return 'Set Exact Stock'
  return 'Add Stock'
}

export const getStockActionLabel = (action) => {
  if (action === 'reduce') return 'Reduce'
  if (action === 'adjust') return 'Set Exact Stock'
  return 'Add'
}

export const getStockMovementLabel = (movementType) => {
  const normalized = String(movementType || '').trim().toUpperCase()

  if (normalized === 'OPENING_STOCK') return 'Opening Stock'
  if (normalized === 'STOCK_IN') return 'Stock In'
  if (normalized === 'STOCK_OUT') return 'Stock Out'
  if (normalized === 'ADJUSTMENT') return 'Adjustment'
  if (normalized === 'SALE_DEDUCTION') return 'Sale Deduction'

  return normalized || 'Unknown'
}

export const getStockMovementClass = (movementType) => {
  const normalized = String(movementType || '').trim().toUpperCase()

  if (normalized === 'OPENING_STOCK') return 'bg-sky-100 text-sky-700 ring-sky-200'
  if (normalized === 'STOCK_IN') return 'bg-emerald-100 text-emerald-700 ring-emerald-200'
  if (normalized === 'STOCK_OUT') return 'bg-amber-100 text-amber-800 ring-amber-200'
  if (normalized === 'ADJUSTMENT') return 'bg-violet-100 text-violet-700 ring-violet-200'
  if (normalized === 'SALE_DEDUCTION') return 'bg-rose-100 text-rose-700 ring-rose-200'

  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

export const getStockReasonOptions = (action) => {
  if (action === 'reduce') {
    return ['Damaged goods', 'Expired stock', 'Internal use', 'Count shortage', 'Other']
  }

  if (action === 'adjust') {
    return ['Physical count reconciliation', 'Opening balance correction', 'System correction', 'Other']
  }

  return ['Purchase receipt', 'Customer return', 'Count surplus', 'Opening balance top-up', 'Other']
}
