export const safeNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roundCurrency = (value) => Number(safeNumber(value).toFixed(2))

const normalizeSupplyType = (value) => (String(value || 'intra').toLowerCase() === 'inter' ? 'inter' : 'intra')

const allocateDiscounts = (lineAmounts = [], totalDiscount = 0) => {
  const allocations = lineAmounts.map(() => 0)
  const grossBase = roundCurrency(lineAmounts.reduce((sum, amount) => sum + safeNumber(amount), 0))
  let remainingDiscount = roundCurrency(totalDiscount)
  let remainingBase = grossBase

  if (remainingDiscount <= 0 || remainingBase <= 0) {
    return allocations
  }

  for (let index = 0; index < lineAmounts.length; index += 1) {
    const lineAmount = roundCurrency(lineAmounts[index])

    if (lineAmount <= 0) {
      allocations[index] = 0
      continue
    }

    let allocation

    if (index === lineAmounts.length - 1 || remainingBase <= 0) {
      allocation = roundCurrency(Math.min(lineAmount, remainingDiscount))
    } else {
      allocation = roundCurrency(Math.min((remainingDiscount * lineAmount) / remainingBase, lineAmount))
    }

    allocations[index] = allocation
    remainingDiscount = roundCurrency(Math.max(0, remainingDiscount - allocation))
    remainingBase = roundCurrency(Math.max(0, remainingBase - lineAmount))
  }

  return allocations
}

const splitRates = (taxRate, supplyType) => {
  const normalizedRate = roundCurrency(taxRate)

  if (normalizedRate <= 0) {
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
    }
  }

  if (normalizeSupplyType(supplyType) === 'inter') {
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: normalizedRate,
    }
  }

  const halfRate = normalizedRate / 2
  return {
    cgstRate: halfRate,
    sgstRate: halfRate,
    igstRate: 0,
  }
}

export const calculateTaxFromAmount = ({ amount, taxRate, supplyType = 'intra', taxType = 'exclusive' }) => {
  const normalizedAmount = roundCurrency(amount)
  const normalizedTaxType = String(taxType || 'exclusive').toLowerCase()
  const normalizedRate = normalizedTaxType === 'exempt' ? 0 : roundCurrency(taxRate)

  if (normalizedAmount <= 0 || normalizedRate <= 0) {
    return {
      taxableAmount: normalizedAmount,
      taxAmount: 0,
      amountWithTax: normalizedAmount,
      ...splitRates(0, supplyType),
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    }
  }

  let taxableAmount = normalizedAmount
  let taxAmount = 0
  let amountWithTax = normalizedAmount

  if (normalizedTaxType === 'inclusive') {
    taxableAmount = roundCurrency((normalizedAmount * 100) / (100 + normalizedRate))
    taxAmount = roundCurrency(normalizedAmount - taxableAmount)
    amountWithTax = normalizedAmount
  } else {
    taxableAmount = normalizedAmount
    taxAmount = roundCurrency((taxableAmount * normalizedRate) / 100)
    amountWithTax = roundCurrency(taxableAmount + taxAmount)
  }

  const rates = splitRates(normalizedRate, supplyType)

  if (rates.igstRate > 0) {
    return {
      taxableAmount,
      taxAmount,
      amountWithTax,
      ...rates,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: taxAmount,
    }
  }

  const cgstAmount = roundCurrency(taxAmount / 2)
  const sgstAmount = roundCurrency(taxAmount - cgstAmount)

  return {
    taxableAmount,
    taxAmount,
    amountWithTax,
    ...rates,
    cgstAmount,
    sgstAmount,
    igstAmount: 0,
  }
}

export const estimateCartTotals = ({ items = [], cartDiscountAmount = 0, supplyType = 'intra' }) => {
  const baseLineAmounts = items.map((item) => safeNumber(item.finalLineTotal ?? item.lineTotal))
  const cartAllocations = allocateDiscounts(baseLineAmounts, cartDiscountAmount)

  let taxableAmount = 0
  let cgstAmount = 0
  let sgstAmount = 0
  let igstAmount = 0
  let totalTaxAmount = 0
  let finalAmount = 0

  items.forEach((item, index) => {
    const postCartAmount = roundCurrency(baseLineAmounts[index] - safeNumber(cartAllocations[index]))
    const tax = calculateTaxFromAmount({
      amount: postCartAmount,
      taxRate: safeNumber(item.gstRate),
      supplyType,
      taxType: item.taxType,
    })

    taxableAmount += tax.taxableAmount
    cgstAmount += tax.cgstAmount
    sgstAmount += tax.sgstAmount
    igstAmount += tax.igstAmount
    totalTaxAmount += tax.taxAmount
    finalAmount += tax.amountWithTax
  })

  return {
    taxableAmount: roundCurrency(taxableAmount),
    cgstAmount: roundCurrency(cgstAmount),
    sgstAmount: roundCurrency(sgstAmount),
    igstAmount: roundCurrency(igstAmount),
    totalTaxAmount: roundCurrency(totalTaxAmount),
    finalAmount: roundCurrency(finalAmount),
  }
}

export const formatInvoiceDate = (value) => {
  if (!value) return 'N/A'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'N/A'
  }

  return parsed.toLocaleString()
}

export const getInvoiceTaxRows = (invoice) => {
  const rows = []
  const supplyType = normalizeSupplyType(invoice?.supplyType)
  const cgstAmount = safeNumber(invoice?.cgstAmount)
  const sgstAmount = safeNumber(invoice?.sgstAmount)
  const igstAmount = safeNumber(invoice?.igstAmount)
  const totalTaxAmount = safeNumber(invoice?.gstAmount)

  if (supplyType === 'inter') {
    rows.push({ label: 'IGST', amount: igstAmount })
  } else {
    rows.push({ label: 'CGST', amount: cgstAmount })
    rows.push({ label: 'SGST', amount: sgstAmount })
  }

  rows.push({ label: 'Total Tax', amount: totalTaxAmount })
  return rows
}
