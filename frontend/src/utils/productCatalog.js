export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const getSellingPrice = (product) => safeNumber(product?.sellingPrice ?? product?.price, 0)

export const getCostPrice = (product) => safeNumber(product?.costPrice, 0)

export const getStock = (product) => safeNumber(product?.stock, 0)

export const getUnitProfit = (product) => getSellingPrice(product) - getCostPrice(product)

export const getMarginPercent = (product) => {
  const selling = getSellingPrice(product)
  if (selling <= 0) return 0
  return (getUnitProfit(product) / selling) * 100
}

export const getStockThreshold = (product) => {
  const reorderPoint = safeNumber(product?.reorderPoint, 0)
  return reorderPoint > 0 ? reorderPoint : 10
}

export const isLowStock = (product) => {
  const stock = getStock(product)
  return stock > 0 && stock <= getStockThreshold(product)
}

export const getStockStatusLabel = (product) => {
  const stock = getStock(product)

  if (stock <= 0) {
    return 'Out of Stock'
  }

  return isLowStock(product) ? 'Low Stock' : 'In Stock'
}

export const getStockStatusClass = (product) => {
  const stock = getStock(product)

  if (stock <= 0) {
    return 'bg-red-100 text-red-700 ring-red-200'
  }

  return isLowStock(product)
    ? 'bg-amber-100 text-amber-700 ring-amber-200'
    : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
}

export const getStatusClass = (status) =>
  String(status || 'active').toLowerCase() === 'inactive'
    ? 'bg-slate-100 text-slate-700 ring-slate-200'
    : 'bg-emerald-100 text-emerald-700 ring-emerald-200'

export const normalizePairs = (rows) => {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => ({
      key: String(row?.key || '').trim(),
      value: String(row?.value || '').trim(),
    }))
    .filter((row) => row.key || row.value)
}

export const inventoryLogLabel = {
  SALE: 'Sale',
  ADJUST: 'Adjustment',
}

export const inventoryLogTone = {
  SALE: 'bg-red-100 text-red-700 ring-red-200',
  ADJUST: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
}
