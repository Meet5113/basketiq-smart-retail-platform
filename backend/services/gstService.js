const GST_SLABS = [5, 12, 18, 28];

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const roundNonNegative = (value) => roundCurrency(Math.max(0, Number(value) || 0));

const normalizeSupplyType = (value) => {
  if (typeof value === "boolean") {
    return value ? "inter" : "intra";
  }

  const normalized = String(value || "intra").trim().toLowerCase();
  return normalized === "inter" ? "inter" : "intra";
};

const normalizeTaxRate = (value, { allowZero = true, fallback = 5 } = {}) => {
  const parsed = Number(value);

  if (allowZero && parsed === 0) {
    return 0;
  }

  return GST_SLABS.includes(parsed) ? parsed : fallback;
};

const normalizeHsnCode = (value) => String(value || "").trim().toUpperCase();

const splitTaxRate = ({ taxRate, supplyType }) => {
  const normalizedRate = normalizeTaxRate(taxRate, { allowZero: true, fallback: 0 });
  const normalizedSupplyType = normalizeSupplyType(supplyType);

  if (normalizedRate === 0) {
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
    };
  }

  if (normalizedSupplyType === "inter") {
    return {
      cgstRate: 0,
      sgstRate: 0,
      igstRate: normalizedRate,
    };
  }

  const halfRate = normalizedRate / 2;

  return {
    cgstRate: halfRate,
    sgstRate: halfRate,
    igstRate: 0,
  };
};

const calculateTaxFromAmount = ({ amount, taxRate, supplyType = "intra", taxType = "exclusive" }) => {
  const normalizedAmount = roundNonNegative(amount);
  const normalizedTaxType = String(taxType || "exclusive").toLowerCase();
  const normalizedRate =
    normalizedTaxType === "exempt"
      ? 0
      : normalizeTaxRate(taxRate, {
          allowZero: true,
          fallback: 5,
        });

  if (normalizedRate === 0 || normalizedAmount === 0) {
    return {
      taxableAmount: normalizedAmount,
      taxAmount: 0,
      amountWithTax: normalizedAmount,
      taxRate: 0,
      ...splitTaxRate({ taxRate: 0, supplyType }),
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    };
  }

  let taxableAmount = normalizedAmount;
  let amountWithTax = normalizedAmount;
  let taxAmount = 0;

  if (normalizedTaxType === "inclusive") {
    taxableAmount = roundCurrency((normalizedAmount * 100) / (100 + normalizedRate));
    taxAmount = roundCurrency(normalizedAmount - taxableAmount);
    amountWithTax = normalizedAmount;
  } else {
    taxableAmount = normalizedAmount;
    taxAmount = roundCurrency((taxableAmount * normalizedRate) / 100);
    amountWithTax = roundCurrency(taxableAmount + taxAmount);
  }

  const rateSplit = splitTaxRate({ taxRate: normalizedRate, supplyType });
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (rateSplit.igstRate > 0) {
    igstAmount = taxAmount;
  } else {
    cgstAmount = roundCurrency(taxAmount / 2);
    sgstAmount = roundCurrency(taxAmount - cgstAmount);
  }

  return {
    taxableAmount,
    taxAmount,
    amountWithTax,
    taxRate: normalizedRate,
    ...rateSplit,
    cgstAmount,
    sgstAmount,
    igstAmount,
  };
};

const buildTaxBreakdown = (items = []) => {
  const grouped = new Map();

  for (const item of items) {
    const hsnCode = normalizeHsnCode(item?.hsnCode || item?.hsnSacCode || "");
    const taxRate = Number(item?.taxRate) || 0;
    const key = `${hsnCode}|${taxRate}`;
    const existing = grouped.get(key) || {
      hsnCode,
      taxRate,
      taxableAmount: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxAmount: 0,
      totalAmount: 0,
    };

    existing.taxableAmount += Number(item?.taxableAmount) || 0;
    existing.cgstAmount += Number(item?.cgstAmount) || 0;
    existing.sgstAmount += Number(item?.sgstAmount) || 0;
    existing.igstAmount += Number(item?.igstAmount) || 0;
    existing.taxAmount += Number(item?.taxAmount) || 0;
    existing.totalAmount += Number(item?.lineAmountWithTax ?? item?.amountWithTax) || 0;

    grouped.set(key, existing);
  }

  return [...grouped.values()].map((entry) => ({
    hsnCode: entry.hsnCode,
    taxRate: entry.taxRate,
    taxableAmount: roundCurrency(entry.taxableAmount),
    cgstAmount: roundCurrency(entry.cgstAmount),
    sgstAmount: roundCurrency(entry.sgstAmount),
    igstAmount: roundCurrency(entry.igstAmount),
    taxAmount: roundCurrency(entry.taxAmount),
    totalAmount: roundCurrency(entry.totalAmount),
  }));
};

module.exports = {
  GST_SLABS,
  normalizeSupplyType,
  normalizeTaxRate,
  normalizeHsnCode,
  splitTaxRate,
  calculateTaxFromAmount,
  buildTaxBreakdown,
  roundCurrency,
};
