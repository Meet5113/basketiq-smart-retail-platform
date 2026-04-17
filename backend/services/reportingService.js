const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const StockLedger = require("../models/StockLedger");
const ApiError = require("../utils/ApiError");

const COMPLETED_ORDER_FILTER = {
  $or: [{ status: "completed" }, { status: { $exists: false } }],
};

const DATE_PRESETS = ["today", "last7", "last30", "custom"];
const PAYMENT_METHODS = ["cash", "upi", "card", "split"];
const GST_RATES = [0, 5, 12, 18, 28];
const DEFAULT_STOCK_THRESHOLD = 10;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));
const toRoundedNumber = (value, fallback = 0) => roundCurrency(toNumber(value, fallback));

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const toUtcStartOfDay = (input) => {
  const date = new Date(input);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
};

const toUtcEndOfDay = (input) => {
  const date = new Date(input);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
};

const addUtcDays = (input, days) => {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const normalizeDatePreset = (value) => {
  const normalized = String(value || "last30").trim().toLowerCase();
  return DATE_PRESETS.includes(normalized) ? normalized : "last30";
};

const normalizePaymentMethod = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) {
    return "";
  }

  if (!PAYMENT_METHODS.includes(normalized)) {
    throw new ApiError(
      400,
      `Payment method must be one of: ${PAYMENT_METHODS.join(", ")}.`,
      "VALIDATION_ERROR"
    );
  }

  return normalized;
};

const parseReportDateRange = ({ datePreset, from, to } = {}) => {
  const presetFromInputs = from || to ? "custom" : normalizeDatePreset(datePreset);
  const today = toUtcStartOfDay(new Date());
  let startDate = null;
  let endDate = null;

  if (presetFromInputs === "today") {
    startDate = today;
    endDate = toUtcEndOfDay(today);
  } else if (presetFromInputs === "last7") {
    startDate = addUtcDays(today, -6);
    endDate = toUtcEndOfDay(today);
  } else if (presetFromInputs === "last30") {
    startDate = addUtcDays(today, -29);
    endDate = toUtcEndOfDay(today);
  } else {
    if (!from || !to) {
      throw new ApiError(
        400,
        "Custom date range requires both `from` and `to`.",
        "VALIDATION_ERROR"
      );
    }

    const parsedFrom = new Date(from);
    const parsedTo = new Date(to);

    if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedTo.getTime())) {
      throw new ApiError(400, "Invalid custom date range.", "VALIDATION_ERROR");
    }

    startDate = toUtcStartOfDay(parsedFrom);
    endDate = toUtcEndOfDay(parsedTo);
  }

  if (startDate > endDate) {
    throw new ApiError(400, "`from` date must be before `to` date.", "VALIDATION_ERROR");
  }

  return {
    datePreset: presetFromInputs,
    startDate,
    endDate,
  };
};

const buildProductScopeQuery = ({ productId, category } = {}) => {
  const query = {};
  const normalizedProductId = String(productId || "").trim();
  const normalizedCategory = String(category || "").trim();

  if (normalizedProductId) {
    validateObjectId(normalizedProductId, "product");
    query._id = new mongoose.Types.ObjectId(normalizedProductId);
  }

  if (normalizedCategory) {
    query.category = normalizedCategory;
  }

  return {
    query,
    normalizedProductId,
    normalizedCategory,
    hasScopedProducts: Boolean(normalizedProductId || normalizedCategory),
  };
};

const buildOrderMatch = ({ range, customerId, paymentMethod } = {}) => {
  const match = {
    ...COMPLETED_ORDER_FILTER,
    createdAt: {
      $gte: range.startDate,
      $lte: range.endDate,
    },
  };

  const normalizedCustomerId = String(customerId || "").trim();
  if (normalizedCustomerId) {
    if (normalizedCustomerId === "walk_in") {
      match.customerId = null;
    } else {
      validateObjectId(normalizedCustomerId, "customer");
      match.customerId = new mongoose.Types.ObjectId(normalizedCustomerId);
    }
  }

  const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
  if (normalizedPaymentMethod) {
    match.paymentMethod = normalizedPaymentMethod;
  }

  return match;
};

const quantityExpression = { $ifNull: ["$items.quantity", 0] };
const lineAmountFallbackExpression = {
  $multiply: [{ $ifNull: ["$items.price", 0] }, quantityExpression],
};
const revenueExpression = {
  $ifNull: [
    "$items.lineAmountWithTax",
    { $ifNull: ["$items.finalLineTotal", lineAmountFallbackExpression] },
  ],
};
const taxableValueExpression = {
  $ifNull: [
    "$items.taxableAmount",
    { $ifNull: ["$items.finalLineTotal", lineAmountFallbackExpression] },
  ],
};
const profitExpression = {
  $ifNull: [
    "$items.profitAmount",
    {
      $subtract: [
        { $ifNull: ["$items.finalLineTotal", lineAmountFallbackExpression] },
        {
          $multiply: [{ $ifNull: ["$items.costPrice", 0] }, quantityExpression],
        },
      ],
    },
  ],
};

const normalizeStandardGstRate = (value) => {
  const parsed = toNumber(value, NaN);
  return GST_RATES.includes(parsed) ? parsed : null;
};

const inferGstRateFromTaxAmounts = ({
  taxableValue,
  gstAmount,
  cgstAmount,
  sgstAmount,
  igstAmount,
} = {}) => {
  const normalizedTaxableValue = toRoundedNumber(taxableValue, 0);

  if (normalizedTaxableValue <= 0) {
    return null;
  }

  const resolvedTaxAmount = toRoundedNumber(
    gstAmount,
    toNumber(cgstAmount, 0) + toNumber(sgstAmount, 0) + toNumber(igstAmount, 0)
  );

  if (resolvedTaxAmount <= 0) {
    return 0;
  }

  const inferredRate = roundCurrency((resolvedTaxAmount * 100) / normalizedTaxableValue);
  return GST_RATES.find((rate) => Math.abs(rate - inferredRate) <= 0.25) ?? null;
};

const normalizeMatchedItemRow = (row) => {
  const lineTotal = toRoundedNumber(
    row.lineTotal,
    toNumber(row.price, 0) * toNumber(row.quantity, 0)
  );
  const itemDiscountAmount = toRoundedNumber(row.itemDiscountAmount, 0);
  const cartDiscountAmount = toRoundedNumber(row.cartDiscountAmount, 0);
  const totalDiscountAmount = toRoundedNumber(
    row.totalDiscountAmount,
    itemDiscountAmount + cartDiscountAmount
  );
  const discountedLineAmount = roundCurrency(Math.max(0, lineTotal - totalDiscountAmount));

  const cgstAmount = toRoundedNumber(row.cgstAmount, 0);
  const sgstAmount = toRoundedNumber(row.sgstAmount, 0);
  const igstAmount = toRoundedNumber(row.igstAmount, 0);
  const gstAmount = toRoundedNumber(
    row.gstAmount,
    cgstAmount + sgstAmount + igstAmount
  );

  const storedTaxableValue = toRoundedNumber(row.taxableValue, 0);
  const fallbackTaxableValue = toRoundedNumber(
    row.finalLineTotal,
    discountedLineAmount
  );
  const taxableValue =
    storedTaxableValue > 0 || discountedLineAmount === 0
      ? storedTaxableValue
      : fallbackTaxableValue;

  const itemRate = normalizeStandardGstRate(row.gstRate);
  const legacyRate = normalizeStandardGstRate(row.legacyGstRate);
  const orderRate = normalizeStandardGstRate(row.orderGstRate);
  const trustedItemRate = itemRate === 0 && gstAmount > 0 ? null : itemRate;
  const trustedLegacyRate = legacyRate === 0 && gstAmount > 0 ? null : legacyRate;
  const trustedOrderRate = orderRate === 0 && gstAmount > 0 ? null : orderRate;

  const normalizedRate =
    trustedItemRate ??
    trustedLegacyRate ??
    inferGstRateFromTaxAmounts({
      taxableValue,
      gstAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
    }) ??
    trustedOrderRate ??
    0;

  const storedLineAmountWithTax = toRoundedNumber(row.lineAmountWithTax, 0);
  const totalAmount =
    storedLineAmountWithTax > 0 || (taxableValue === 0 && gstAmount === 0)
      ? storedLineAmountWithTax
      : roundCurrency(taxableValue + gstAmount);

  return {
    ...row,
    quantity: toRoundedNumber(row.quantity, 0),
    taxableValue,
    gstRate: normalizedRate,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
  };
};

const buildMatchedItemsPipeline = ({ orderMatch, productIds } = {}) => {
  const pipeline = [{ $match: orderMatch }, { $unwind: "$items" }];

  if (Array.isArray(productIds) && productIds.length > 0) {
    pipeline.push({
      $match: {
        "items.productId": { $in: productIds },
      },
    });
  }

  return pipeline;
};

const getMatchedItemRows = async ({ orderMatch, productIds } = {}) => {
  if (Array.isArray(productIds) && productIds.length === 0) {
    return [];
  }

  const rows = await Order.aggregate([
    ...buildMatchedItemsPipeline({ orderMatch, productIds }),
    {
      $project: {
        _id: 0,
        orderId: { $toString: "$_id" },
        invoiceId: { $ifNull: ["$invoiceNumber", ""] },
        createdAt: 1,
        customerId: {
          $cond: [
            { $ifNull: ["$customerId", false] },
            { $toString: "$customerId" },
            null,
          ],
        },
        customerName: { $ifNull: ["$customerName", "Walk-in Customer"] },
        customerGstin: { $ifNull: ["$customerGstin", ""] },
        paymentMethod: { $ifNull: ["$paymentMethod", "cash"] },
        productId: {
          $cond: [
            { $ifNull: ["$items.productId", false] },
            { $toString: "$items.productId" },
            null,
          ],
        },
        productName: { $ifNull: ["$items.name", "Unnamed Product"] },
        sku: { $ifNull: ["$items.sku", ""] },
        quantity: quantityExpression,
        totalAmount: revenueExpression,
        taxableValue: taxableValueExpression,
        profitAmount: profitExpression,
        gstRate: { $ifNull: ["$items.taxRate", null] },
        legacyGstRate: { $ifNull: ["$items.gstRate", null] },
        orderGstRate: { $ifNull: ["$gstRate", null] },
        gstAmount: { $ifNull: ["$items.taxAmount", 0] },
        cgstAmount: { $ifNull: ["$items.cgstAmount", 0] },
        sgstAmount: { $ifNull: ["$items.sgstAmount", 0] },
        igstAmount: { $ifNull: ["$items.igstAmount", 0] },
        price: { $ifNull: ["$items.price", 0] },
        lineTotal: { $ifNull: ["$items.lineTotal", lineAmountFallbackExpression] },
        itemDiscountAmount: { $ifNull: ["$items.discountAmount", 0] },
        cartDiscountAmount: { $ifNull: ["$items.cartDiscountAmount", 0] },
        totalDiscountAmount: {
          $ifNull: [
            "$items.totalDiscountAmount",
            {
              $add: [
                { $ifNull: ["$items.discountAmount", 0] },
                { $ifNull: ["$items.cartDiscountAmount", 0] },
              ],
            },
          ],
        },
        finalLineTotal: { $ifNull: ["$items.finalLineTotal", 0] },
        lineAmountWithTax: { $ifNull: ["$items.lineAmountWithTax", 0] },
      },
    },
    { $sort: { createdAt: -1, orderId: -1 } },
  ]);

  return rows.map(normalizeMatchedItemRow);
};

const getProductThreshold = (product) => {
  const reorderPoint = toNumber(product?.reorderPoint, 0);
  return reorderPoint > 0 ? reorderPoint : DEFAULT_STOCK_THRESHOLD;
};

const getLowStockLabel = (quantity, threshold) => {
  if (quantity <= 0) {
    return "Out of Stock";
  }

  if (quantity <= threshold) {
    return "Low Stock";
  }

  return "Healthy";
};

const buildSalesReport = (itemRows) => {
  const orderMap = new Map();
  let totalItems = 0;

  itemRows.forEach((row) => {
    const key = String(row.orderId);
    const current = orderMap.get(key) || {
      id: key,
      date: row.createdAt,
      orderId: row.invoiceId || `Order ${key.slice(-6)}`,
      customer: row.customerName || "Walk-in Customer",
      customerId: row.customerId || null,
      customerGstin: row.customerGstin || "",
      paymentMethod: row.paymentMethod || "cash",
      totalQuantity: 0,
      totalAmount: 0,
      gstAmount: 0,
      itemNames: new Set(),
      itemLineCount: 0,
    };

    current.totalQuantity += toNumber(row.quantity, 0);
    current.totalAmount += toNumber(row.totalAmount, 0);
    current.gstAmount += toNumber(row.gstAmount, 0);
    current.itemLineCount += 1;
    current.itemNames.add(row.productName || "Product");
    orderMap.set(key, current);
    totalItems += toNumber(row.quantity, 0);
  });

  const rows = [...orderMap.values()]
    .map((row) => ({
      id: row.id,
      date: row.date,
      orderId: row.orderId,
      customer: row.customer,
      customerId: row.customerId,
      customerGstin: row.customerGstin,
      paymentMethod: row.paymentMethod,
      totalQuantity: roundCurrency(row.totalQuantity),
      itemLineCount: row.itemLineCount,
      itemNames: [...row.itemNames],
      totalAmount: roundCurrency(row.totalAmount),
      gstAmount: roundCurrency(row.gstAmount),
    }))
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime() ||
        String(right.orderId).localeCompare(String(left.orderId))
    );

  return {
    summary: {
      totalOrders: rows.length,
      totalItems: roundCurrency(totalItems),
      totalAmount: roundCurrency(rows.reduce((sum, row) => sum + row.totalAmount, 0)),
      totalGst: roundCurrency(rows.reduce((sum, row) => sum + row.gstAmount, 0)),
    },
    rows,
  };
};

const buildProductReport = ({ scopeProducts, itemRows } = {}) => {
  const metricsByProduct = new Map();

  itemRows.forEach((row) => {
    const key = String(row.productId || "");
    if (!key) {
      return;
    }

    const current = metricsByProduct.get(key) || {
      quantitySold: 0,
      revenue: 0,
      profit: 0,
    };

    current.quantitySold += toNumber(row.quantity, 0);
    current.revenue += toNumber(row.totalAmount, 0);
    current.profit += toNumber(row.profitAmount, 0);
    metricsByProduct.set(key, current);
  });

  const rows = (scopeProducts || [])
    .map((product) => {
      const key = String(product._id);
      const metric = metricsByProduct.get(key) || {
        quantitySold: 0,
        revenue: 0,
        profit: 0,
      };

      return {
        id: key,
        productId: key,
        productName: product.name || "Unnamed Product",
        sku: product.sku || "",
        quantitySold: roundCurrency(metric.quantitySold),
        revenue: roundCurrency(metric.revenue),
        profit: roundCurrency(metric.profit),
        currentStock: roundCurrency(product.stock || 0),
      };
    })
    .sort(
      (left, right) =>
        right.revenue - left.revenue ||
        right.quantitySold - left.quantitySold ||
        left.productName.localeCompare(right.productName)
    );

  return {
    summary: {
      totalProducts: rows.length,
      totalQuantitySold: roundCurrency(rows.reduce((sum, row) => sum + row.quantitySold, 0)),
      totalRevenue: roundCurrency(rows.reduce((sum, row) => sum + row.revenue, 0)),
      totalProfit: roundCurrency(rows.reduce((sum, row) => sum + row.profit, 0)),
    },
    rows,
  };
};

const buildCustomerReport = (salesRows) => {
  const customerMap = new Map();

  salesRows.forEach((row) => {
    const isWalkIn = !row.customerId;
    const key = isWalkIn ? "walk_in" : String(row.customerId);
    const customerType = isWalkIn ? "Walk-in" : row.customerGstin ? "GST" : "Regular";

    const current = customerMap.get(key) || {
      id: key,
      customerName: isWalkIn ? "Walk-in Customer" : row.customer || "Customer",
      ordersCount: 0,
      totalSpend: 0,
      lastPurchaseDate: null,
      customerType,
    };

    current.ordersCount += 1;
    current.totalSpend += toNumber(row.totalAmount, 0);

    if (
      !current.lastPurchaseDate ||
      new Date(row.date).getTime() > new Date(current.lastPurchaseDate).getTime()
    ) {
      current.lastPurchaseDate = row.date;
    }

    customerMap.set(key, current);
  });

  const rows = [...customerMap.values()]
    .map((row) => ({
      ...row,
      totalSpend: roundCurrency(row.totalSpend),
    }))
    .sort(
      (left, right) =>
        right.totalSpend - left.totalSpend ||
        right.ordersCount - left.ordersCount ||
        left.customerName.localeCompare(right.customerName)
    );

  return {
    summary: {
      totalCustomers: rows.length,
      totalOrders: rows.reduce((sum, row) => sum + row.ordersCount, 0),
      totalSpend: roundCurrency(rows.reduce((sum, row) => sum + row.totalSpend, 0)),
      gstCustomers: rows.filter((row) => row.customerType === "GST").length,
      regularCustomers: rows.filter((row) => row.customerType === "Regular").length,
      walkInCustomers: rows.filter((row) => row.customerType === "Walk-in").length,
    },
    rows,
  };
};

const buildGstReport = (itemRows) => {
  const rateMap = new Map(
    GST_RATES.map((rate) => [
      String(rate),
      {
        rate,
        summary: {
          totalTaxableValue: 0,
          totalGstCollected: 0,
          totalCgst: 0,
          totalSgst: 0,
          totalIgst: 0,
          totalInvoiceValue: 0,
          totalRows: 0,
        },
        rows: [],
      },
    ])
  );

  itemRows.forEach((row, index) => {
    const normalizedRate = GST_RATES.includes(toNumber(row.gstRate, 0))
      ? toNumber(row.gstRate, 0)
      : 0;
    const bucket = rateMap.get(String(normalizedRate));

    const formattedRow = {
      id: `${row.orderId}-${row.productId || "product"}-${index}`,
      date: row.createdAt,
      invoiceId: row.invoiceId || `Order ${String(row.orderId).slice(-6)}`,
      product: row.productName || "Unnamed Product",
      taxableValue: roundCurrency(row.taxableValue),
      gstRate: normalizedRate,
      cgst: roundCurrency(row.cgstAmount),
      sgst: roundCurrency(row.sgstAmount),
      igst: roundCurrency(row.igstAmount),
      total: roundCurrency(row.totalAmount),
    };

    bucket.rows.push(formattedRow);
    bucket.summary.totalTaxableValue += toNumber(formattedRow.taxableValue, 0);
    bucket.summary.totalCgst += toNumber(formattedRow.cgst, 0);
    bucket.summary.totalSgst += toNumber(formattedRow.sgst, 0);
    bucket.summary.totalIgst += toNumber(formattedRow.igst, 0);
    bucket.summary.totalInvoiceValue += toNumber(formattedRow.total, 0);
    bucket.summary.totalGstCollected += roundCurrency(
      toNumber(formattedRow.cgst, 0) +
        toNumber(formattedRow.sgst, 0) +
        toNumber(formattedRow.igst, 0)
    );
    bucket.summary.totalRows += 1;
  });

  const rates = GST_RATES.map((rate) => {
    const bucket = rateMap.get(String(rate));
    return {
      rate,
      summary: {
        totalTaxableValue: roundCurrency(bucket.summary.totalTaxableValue),
        totalGstCollected: roundCurrency(bucket.summary.totalGstCollected),
        totalCgst: roundCurrency(bucket.summary.totalCgst),
        totalSgst: roundCurrency(bucket.summary.totalSgst),
        totalIgst: roundCurrency(bucket.summary.totalIgst),
        totalInvoiceValue: roundCurrency(bucket.summary.totalInvoiceValue),
        totalRows: bucket.summary.totalRows,
      },
      rows: bucket.rows.sort(
        (left, right) =>
          new Date(right.date).getTime() - new Date(left.date).getTime() ||
          String(right.invoiceId).localeCompare(String(left.invoiceId))
      ),
    };
  });

  return {
    summary: {
      totalTaxableValue: roundCurrency(
        rates.reduce((sum, rate) => sum + rate.summary.totalTaxableValue, 0)
      ),
      totalGstCollected: roundCurrency(
        rates.reduce((sum, rate) => sum + rate.summary.totalGstCollected, 0)
      ),
      totalCgst: roundCurrency(
        rates.reduce((sum, rate) => sum + rate.summary.totalCgst, 0)
      ),
      totalSgst: roundCurrency(
        rates.reduce((sum, rate) => sum + rate.summary.totalSgst, 0)
      ),
      totalIgst: roundCurrency(
        rates.reduce((sum, rate) => sum + rate.summary.totalIgst, 0)
      ),
      totalInvoiceValue: roundCurrency(
        rates.reduce((sum, rate) => sum + rate.summary.totalInvoiceValue, 0)
      ),
    },
    rates,
  };
};

const buildInventoryReport = async ({ scopeProducts, range } = {}) => {
  const productIds = (scopeProducts || []).map((product) => product._id);

  if (productIds.length === 0) {
    return {
      summary: {
        totalProducts: 0,
        totalOpeningStock: 0,
        totalStockIn: 0,
        totalStockOut: 0,
        totalClosingStock: 0,
        lowStockCount: 0,
      },
      rows: [],
    };
  }

  const movements = await StockLedger.find({
    productId: { $in: productIds },
    movementDate: { $lte: range.endDate },
  })
    .select("productId changeQty movementDate")
    .sort({ movementDate: 1, _id: 1 })
    .lean();

  const movementMap = new Map();
  movements.forEach((movement) => {
    const key = String(movement.productId);
    const existing = movementMap.get(key) || [];
    existing.push(movement);
    movementMap.set(key, existing);
  });

  const rows = scopeProducts
    .map((product) => {
      const key = String(product._id);
      const productMovements = movementMap.get(key) || [];
      const threshold = getProductThreshold(product);

      let openingStock = 0;
      let stockIn = 0;
      let stockOut = 0;

      productMovements.forEach((movement) => {
        const movementDate = new Date(movement.movementDate);
        const changeQty = toNumber(movement.changeQty, 0);

        if (movementDate < range.startDate) {
          openingStock += changeQty;
          return;
        }

        if (movementDate > range.endDate) {
          return;
        }

        if (changeQty >= 0) {
          stockIn += changeQty;
        } else {
          stockOut += Math.abs(changeQty);
        }
      });

      let closingStock = openingStock + stockIn - stockOut;

      if (productMovements.length === 0) {
        openingStock = toNumber(product.stock, 0);
        closingStock = toNumber(product.stock, 0);
      }

      return {
        id: key,
        productId: key,
        product: product.name || "Unnamed Product",
        openingStock: roundCurrency(openingStock),
        stockIn: roundCurrency(stockIn),
        stockOut: roundCurrency(stockOut),
        closingStock: roundCurrency(closingStock),
        lowStockIndicator: getLowStockLabel(closingStock, threshold),
      };
    })
    .sort((left, right) => {
      const statusRank = {
        "Out of Stock": 0,
        "Low Stock": 1,
        Healthy: 2,
      };

      return (
        statusRank[left.lowStockIndicator] - statusRank[right.lowStockIndicator] ||
        left.product.localeCompare(right.product)
      );
    });

  return {
    summary: {
      totalProducts: rows.length,
      totalOpeningStock: roundCurrency(rows.reduce((sum, row) => sum + row.openingStock, 0)),
      totalStockIn: roundCurrency(rows.reduce((sum, row) => sum + row.stockIn, 0)),
      totalStockOut: roundCurrency(rows.reduce((sum, row) => sum + row.stockOut, 0)),
      totalClosingStock: roundCurrency(rows.reduce((sum, row) => sum + row.closingStock, 0)),
      lowStockCount: rows.filter((row) => row.lowStockIndicator !== "Healthy").length,
    },
    rows,
  };
};

const getRetailBusinessReports = async ({
  datePreset,
  from,
  to,
  productId,
  category,
  customerId,
  paymentMethod,
} = {}) => {
  const range = parseReportDateRange({ datePreset, from, to });
  const productScope = buildProductScopeQuery({ productId, category });
  const scopeProducts = await Product.find(productScope.query)
    .select("_id name sku category stock reorderPoint")
    .sort({ name: 1 });

  const scopedProductIds = productScope.hasScopedProducts
    ? scopeProducts.map((product) => product._id)
    : null;
  const orderMatch = buildOrderMatch({
    range,
    customerId,
    paymentMethod,
  });

  const itemRows = await getMatchedItemRows({
    orderMatch,
    productIds: scopedProductIds,
  });

  const hasSalesScopedInventoryFilter = Boolean(
    String(customerId || "").trim() || normalizePaymentMethod(paymentMethod)
  );
  const inventoryScopedProductIds = new Set(
    itemRows.map((row) => String(row.productId || "")).filter(Boolean)
  );
  const inventoryProducts = hasSalesScopedInventoryFilter
    ? scopeProducts.filter((product) => inventoryScopedProductIds.has(String(product._id)))
    : scopeProducts;
  const inventoryReport = await buildInventoryReport({
    scopeProducts: inventoryProducts,
    range,
  });

  const salesReport = buildSalesReport(itemRows);
  const productReport = buildProductReport({ scopeProducts, itemRows });
  const customerReport = buildCustomerReport(salesReport.rows);
  const gstReport = buildGstReport(itemRows);

  return {
    appliedFilters: {
      datePreset: range.datePreset,
      from: range.startDate,
      to: range.endDate,
      productId: productScope.normalizedProductId,
      category: productScope.normalizedCategory,
      customerId: String(customerId || "").trim(),
      paymentMethod: normalizePaymentMethod(paymentMethod),
    },
    salesReport,
    productReport,
    inventoryReport,
    customerReport,
    gstReport,
  };
};

module.exports = {
  getRetailBusinessReports,
};
