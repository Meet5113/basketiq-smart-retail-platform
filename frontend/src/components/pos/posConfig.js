export const discountTypeOptions = [
  { value: 'flat', label: 'Flat' },
  { value: 'percent', label: '%' },
]

export const supplyTypeOptions = [
  { value: 'intra', label: 'Same State (CGST + SGST)' },
  { value: 'inter', label: 'Different State (IGST)' },
]

export const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'split', label: 'Split (Cash + UPI)' },
]

export const getProductStockState = (product) => {
  const stock = Number(product?.stock || 0)

  if (stock <= 0) {
    return {
      label: 'Out of stock',
      className: 'border border-rose-200 bg-rose-50 text-rose-700',
    }
  }

  const threshold = Number(product?.reorderPoint || 0)

  if (threshold > 0 && stock <= threshold) {
    return {
      label: 'Low stock',
      className: 'border border-amber-200 bg-amber-50 text-amber-800',
    }
  }

  return {
    label: 'In stock',
    className: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  }
}
