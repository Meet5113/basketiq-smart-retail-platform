const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");

const COMPLETED_ORDER_FILTER = {
  $or: [{ status: "completed" }, { status: { $exists: false } }],
};

const DATE_PRESETS = ["today", "last7", "last30", "custom"];
const SALES_PERIODS = ["daily", "weekly", "monthly"];
const PAYMENT_METHODS = ["cash", "upi", "card", "split"];
const DEFAULT_STOCK_THRESHOLD = 10;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const formatPercent = (value) => Number((Number(value) || 0).toFixed(2));

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

const addUtcMonths = (input, months) => {
  const date = new Date(input);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
};

const formatDateKey = (input) => {
  const date = new Date(input);
  return date.toISOString().split("T")[0];
};

const formatDateLabel = (input) => {
  const date = new Date(input);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

const getIsoWeekInfo = (input) => {
  const date = new Date(input);
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((normalized - yearStart) / 86400000 + 1) / 7);

  return {
    year: normalized.getUTCFullYear(),
    week,
  };
};

const startOfIsoWeekUtc = (input) => {
  const date = new Date(input);
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() - day + 1);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

const getWeekKey = (input) => {
  const iso = getIsoWeekInfo(input);
  return `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
};

const getMonthKey = (input) => {
  const date = new Date(input);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const formatPeriodLabel = (period, key, bucketDate) => {
  if (period === "weekly") {
    return key;
  }

  if (period === "monthly") {
    return new Date(bucketDate).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return new Date(bucketDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
};

const normalizeDatePreset = (value) => {
  const normalized = String(value || "last30").trim().toLowerCase();
  return DATE_PRESETS.includes(normalized) ? normalized : "last30";
};

const normalizeSalesPeriod = (value) => {
  const normalized = String(value || "daily").trim().toLowerCase();
  return SALES_PERIODS.includes(normalized) ? normalized : "daily";
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

const parseDashboardDateRange = ({
  datePreset,
  from,
  to,
} = {}) => {
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

  const inclusiveDurationMs = endDate.getTime() - startDate.getTime() + 1;
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(startDate.getTime() - inclusiveDurationMs);

  return {
    datePreset: presetFromInputs,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
  };
};

const buildOrderMatch = ({
  range,
  customerId,
  paymentMethod,
} = {}) => {
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

const getOrderContributionRows = async ({ orderMatch, productIds } = {}) => {
  if (Array.isArray(productIds) && productIds.length === 0) {
    return [];
  }

  return Order.aggregate([
    ...buildMatchedItemsPipeline({ orderMatch, productIds }),
    {
      $group: {
        _id: "$_id",
        orderId: { $first: "$_id" },
        invoiceNumber: { $first: "$invoiceNumber" },
        createdAt: { $first: "$createdAt" },
        customerId: { $first: "$customerId" },
        customerName: { $first: "$customerName" },
        customerPhone: { $first: "$customerPhone" },
        customerEmail: { $first: "$customerEmail" },
        customerGstin: { $first: "$customerGstin" },
        paymentMethod: { $first: "$paymentMethod" },
        revenue: { $sum: revenueExpression },
        profit: { $sum: profitExpression },
        taxableValue: { $sum: taxableValueExpression },
        gstAmount: { $sum: { $ifNull: ["$items.taxAmount", 0] } },
        cgstAmount: { $sum: { $ifNull: ["$items.cgstAmount", 0] } },
        sgstAmount: { $sum: { $ifNull: ["$items.sgstAmount", 0] } },
        igstAmount: { $sum: { $ifNull: ["$items.igstAmount", 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        orderId: 1,
        invoiceNumber: { $ifNull: ["$invoiceNumber", ""] },
        createdAt: 1,
        customerId: 1,
        customerName: 1,
        customerPhone: 1,
        customerEmail: 1,
        customerGstin: 1,
        paymentMethod: 1,
        revenue: { $round: ["$revenue", 2] },
        profit: { $round: ["$profit", 2] },
        taxableValue: { $round: ["$taxableValue", 2] },
        gstAmount: { $round: ["$gstAmount", 2] },
        cgstAmount: { $round: ["$cgstAmount", 2] },
        sgstAmount: { $round: ["$sgstAmount", 2] },
        igstAmount: { $round: ["$igstAmount", 2] },
      },
    },
    { $sort: { createdAt: 1, orderId: 1 } },
  ]);
};

const getProductMetricRows = async ({ orderMatch, productIds } = {}) => {
  if (Array.isArray(productIds) && productIds.length === 0) {
    return [];
  }

  return Order.aggregate([
    ...buildMatchedItemsPipeline({ orderMatch, productIds }),
    {
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" },
        sku: { $first: "$items.sku" },
        unitsSold: { $sum: quantityExpression },
        revenue: { $sum: revenueExpression },
        profit: { $sum: profitExpression },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: 1,
        sku: 1,
        unitsSold: { $round: ["$unitsSold", 2] },
        revenue: { $round: ["$revenue", 2] },
        profit: { $round: ["$profit", 2] },
      },
    },
    { $sort: { revenue: -1, unitsSold: -1, name: 1 } },
  ]);
};

const buildRecentOrders = (rows) =>
  (rows || [])
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() ||
        String(right.invoiceNumber || "").localeCompare(String(left.invoiceNumber || ""))
    )
    .slice(0, 8)
    .map((row) => ({
      id: row.orderId,
      invoiceNumber: row.invoiceNumber || "",
      customerName: row.customerName || "Walk-in Customer",
      amount: roundCurrency(row.revenue || 0),
      status: "completed",
      date: row.createdAt,
    }));

const getGstRateBreakdown = async ({ orderMatch, productIds } = {}) => {
  if (Array.isArray(productIds) && productIds.length === 0) {
    return [];
  }

  return Order.aggregate([
    ...buildMatchedItemsPipeline({ orderMatch, productIds }),
    {
      $group: {
        _id: { $ifNull: ["$items.taxRate", 0] },
        taxableValue: { $sum: taxableValueExpression },
        gstAmount: { $sum: { $ifNull: ["$items.taxAmount", 0] } },
        cgstAmount: { $sum: { $ifNull: ["$items.cgstAmount", 0] } },
        sgstAmount: { $sum: { $ifNull: ["$items.sgstAmount", 0] } },
        igstAmount: { $sum: { $ifNull: ["$items.igstAmount", 0] } },
        invoiceValue: { $sum: revenueExpression },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        gstRate: "$_id",
        taxableValue: { $round: ["$taxableValue", 2] },
        gstAmount: { $round: ["$gstAmount", 2] },
        cgstAmount: { $round: ["$cgstAmount", 2] },
        sgstAmount: { $round: ["$sgstAmount", 2] },
        igstAmount: { $round: ["$igstAmount", 2] },
        invoiceValue: { $round: ["$invoiceValue", 2] },
      },
    },
  ]);
};

const buildTrendBuckets = ({ startDate, endDate, period } = {}) => {
  const buckets = [];

  if (period === "weekly") {
    let cursor = startOfIsoWeekUtc(startDate);
    const finalCursor = startOfIsoWeekUtc(endDate);

    while (cursor <= finalCursor) {
      const key = getWeekKey(cursor);
      buckets.push({
        key,
        label: formatPeriodLabel(period, key, cursor),
        bucketDate: cursor.toISOString(),
      });
      cursor = addUtcDays(cursor, 7);
    }

    return buckets;
  }

  if (period === "monthly") {
    let cursor = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1, 0, 0, 0, 0)
    );
    const finalCursor = new Date(
      Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1, 0, 0, 0, 0)
    );

    while (cursor <= finalCursor) {
      const key = getMonthKey(cursor);
      buckets.push({
        key,
        label: formatPeriodLabel(period, key, cursor),
        bucketDate: cursor.toISOString(),
      });
      cursor = addUtcMonths(cursor, 1);
    }

    return buckets;
  }

  let cursor = toUtcStartOfDay(startDate);
  const finalCursor = toUtcStartOfDay(endDate);

  while (cursor <= finalCursor) {
    const key = formatDateKey(cursor);
    buckets.push({
      key,
      label: formatPeriodLabel(period, key, cursor),
      bucketDate: cursor.toISOString(),
    });
    cursor = addUtcDays(cursor, 1);
  }

  return buckets;
};

const getTrendBucketKey = (input, period) => {
  if (period === "weekly") {
    return getWeekKey(input);
  }

  if (period === "monthly") {
    return getMonthKey(input);
  }

  return formatDateKey(input);
};

const buildSalesTrend = ({ rows, startDate, endDate, period } = {}) => {
  const buckets = buildTrendBuckets({ startDate, endDate, period });
  const totalsByKey = new Map();

  rows.forEach((row) => {
    const key = getTrendBucketKey(row.createdAt, period);
    const current = totalsByKey.get(key) || {
      revenue: 0,
      profit: 0,
      orders: 0,
    };

    current.revenue += toNumber(row.revenue, 0);
    current.profit += toNumber(row.profit, 0);
    current.orders += 1;
    totalsByKey.set(key, current);
  });

  return buckets.map((bucket) => {
    const totals = totalsByKey.get(bucket.key) || {
      revenue: 0,
      profit: 0,
      orders: 0,
    };
    const averageOrderValue =
      totals.orders > 0 ? roundCurrency(totals.revenue / totals.orders) : 0;

    return {
      key: bucket.key,
      label: bucket.label,
      bucketDate: bucket.bucketDate,
      revenue: roundCurrency(totals.revenue),
      profit: roundCurrency(totals.profit),
      orders: totals.orders,
      averageOrderValue,
    };
  });
};

const buildCustomerInsights = (rows) => {
  const customerMap = new Map();
  let walkInOrders = 0;

  rows.forEach((row) => {
    if (!row.customerId) {
      walkInOrders += 1;
      return;
    }

    const key = String(row.customerId);
    const current = customerMap.get(key) || {
      customerId: row.customerId,
      name: row.customerName || "Customer",
      phone: row.customerPhone || "",
      email: row.customerEmail || "",
      gstin: row.customerGstin || "",
      orders: 0,
      totalSpend: 0,
      lastPurchaseDate: null,
    };

    current.orders += 1;
    current.totalSpend += toNumber(row.revenue, 0);

    if (
      !current.lastPurchaseDate ||
      new Date(row.createdAt).getTime() > new Date(current.lastPurchaseDate).getTime()
    ) {
      current.lastPurchaseDate = row.createdAt;
    }

    customerMap.set(key, current);
  });

  const customers = [...customerMap.values()]
    .map((customer) => ({
      ...customer,
      totalSpend: roundCurrency(customer.totalSpend),
    }))
    .sort(
      (left, right) =>
        right.totalSpend - left.totalSpend ||
        right.orders - left.orders ||
        String(left.name || "").localeCompare(String(right.name || ""))
    );

  const repeatCustomers = customers.filter((customer) => customer.orders > 1).length;
  const newCustomers = customers.filter((customer) => customer.orders === 1).length;
  const namedCustomerCount = customers.length;
  const totalSpend = customers.reduce(
    (sum, customer) => sum + toNumber(customer.totalSpend, 0),
    0
  );
  const averageSpendPerCustomer =
    namedCustomerCount > 0 ? roundCurrency(totalSpend / namedCustomerCount) : 0;
  const repeatCustomerRate =
    namedCustomerCount > 0
      ? formatPercent((repeatCustomers / namedCustomerCount) * 100)
      : 0;

  return {
    summary: {
      namedCustomerCount,
      repeatCustomers,
      newCustomers,
      walkInOrders,
      averageSpendPerCustomer,
      repeatCustomerRate,
    },
    topCustomers: customers.slice(0, 5),
    customers,
  };
};

const buildProductAnalytics = ({ scopeProducts, metricRows } = {}) => {
  const metricsByProductId = new Map(
    (metricRows || []).map((metric) => [String(metric.productId), metric])
  );

  return (scopeProducts || [])
    .map((product) => {
      const metric = metricsByProductId.get(String(product._id));
      const currentStock = toNumber(product.stock, 0);
      const reorderPoint =
        toNumber(product.reorderPoint, 0) > 0
          ? toNumber(product.reorderPoint, 0)
          : DEFAULT_STOCK_THRESHOLD;
      const unitsSold = roundCurrency(metric?.unitsSold || 0);
      const revenue = roundCurrency(metric?.revenue || 0);
      const profit = roundCurrency(metric?.profit || 0);
      const marginPercent = revenue > 0 ? formatPercent((profit / revenue) * 100) : 0;
      const stockTurnover =
        unitsSold > 0
          ? roundCurrency(
              unitsSold / Math.max((Math.max(currentStock, 0) + unitsSold) / 2, 1)
            )
          : 0;

      return {
        productId: product._id,
        name: product.name || "Unnamed Product",
        sku: product.sku || "",
        category: product.category || "",
        currentStock,
        reorderPoint,
        costPrice: roundCurrency(product.costPrice || 0),
        sellingPrice: roundCurrency(product.sellingPrice ?? product.price ?? 0),
        unitsSold,
        revenue,
        profit,
        marginPercent,
        stockTurnover,
        status: product.status || "active",
      };
    })
    .sort(
      (left, right) =>
        right.revenue - left.revenue ||
        right.unitsSold - left.unitsSold ||
        String(left.name || "").localeCompare(String(right.name || ""))
    );
};

const buildCategoryDistribution = (productAnalytics = []) => {
  const categoryMap = new Map();

  (productAnalytics || []).forEach((product) => {
    const revenue = roundCurrency(product?.revenue || 0);
    if (revenue <= 0) {
      return;
    }

    const category = String(product?.category || "").trim() || "Uncategorized";
    const current = categoryMap.get(category) || {
      category,
      revenue: 0,
    };

    current.revenue += revenue;
    categoryMap.set(category, current);
  });

  const rows = [...categoryMap.values()].sort(
    (left, right) =>
      right.revenue - left.revenue || left.category.localeCompare(right.category)
  );
  const totalRevenue = rows.reduce(
    (sum, row) => sum + toNumber(row.revenue, 0),
    0
  );

  return rows.map((row) => ({
    category: row.category,
    revenue: roundCurrency(row.revenue),
    percentage:
      totalRevenue > 0 ? formatPercent((toNumber(row.revenue, 0) / totalRevenue) * 100) : 0,
  }));
};

const buildInventoryInsights = (productAnalytics) => {
  const lowStock = productAnalytics
    .filter((product) => product.currentStock <= product.reorderPoint)
    .sort(
      (left, right) =>
        left.currentStock - right.currentStock ||
        right.reorderPoint - left.reorderPoint ||
        String(left.name || "").localeCompare(String(right.name || ""))
    )
    .slice(0, 8)
    .map((product) => ({
      ...product,
      status: product.currentStock <= 0 ? "Out of Stock" : "Low Stock",
    }));

  const deadStock = productAnalytics
    .filter((product) => product.unitsSold <= 0 && product.currentStock > 0)
    .sort(
      (left, right) =>
        right.currentStock - left.currentStock ||
        String(left.name || "").localeCompare(String(right.name || ""))
    )
    .slice(0, 8);

  const fastMoving = productAnalytics
    .filter((product) => product.unitsSold > 0)
    .sort(
      (left, right) =>
        right.unitsSold - left.unitsSold ||
        right.revenue - left.revenue ||
        String(left.name || "").localeCompare(String(right.name || ""))
    )
    .slice(0, 8);

  return {
    summary: {
      lowStockCount: lowStock.length,
      deadStockCount: deadStock.length,
      fastMovingCount: fastMoving.length,
    },
    lowStock,
    deadStock,
    fastMoving,
  };
};

const calculateChangePercent = (currentValue, previousValue) => {
  const current = toNumber(currentValue, 0);
  const previous = toNumber(previousValue, 0);

  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return formatPercent(((current - previous) / previous) * 100);
};

const sumOrderMetric = (rows, key) =>
  roundCurrency(
    (rows || []).reduce((sum, row) => sum + toNumber(row?.[key], 0), 0)
  );

const buildSparkline = (rows, key) =>
  (rows || []).map((row) => roundCurrency(row?.[key] || 0));

const buildTopProductSparkline = (products) =>
  (products || []).slice(0, 8).map((product) => roundCurrency(product.revenue || 0));

const getReportFilterOptions = async () => {
  const [products, customers, categories] = await Promise.all([
    Product.find({})
      .select("_id name sku category")
      .sort({ name: 1 }),
    Customer.find({ $or: [{ isActive: true }, { isActive: { $exists: false } }] })
      .select("_id name phone email customerType gstin")
      .sort({ name: 1 }),
    Product.distinct("category", {
      category: { $exists: true, $type: "string", $ne: "" },
    }),
  ]);

  const data = {
    datePresets: [
      { value: "today", label: "Today" },
      { value: "last7", label: "Last 7 Days" },
      { value: "last30", label: "Last 30 Days" },
      { value: "custom", label: "Custom Range" },
    ],
    paymentMethods: PAYMENT_METHODS.map((method) => ({
      value: method,
      label: method === "upi" ? "UPI" : method.charAt(0).toUpperCase() + method.slice(1),
    })),
    categories: [...categories]
      .map((category) => String(category || "").trim())
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right))
      .map((category) => ({ value: category, label: category })),
    products: products.map((product) => ({
      value: String(product._id),
      label: product.sku ? `${product.name} (${product.sku})` : product.name,
      name: product.name,
      sku: product.sku || "",
      category: product.category || "",
    })),
    customers: [
      {
        value: "walk_in",
        label: "Walk-in Customer",
        phone: "",
        email: "",
      },
      ...customers.map((customer) => ({
        value: String(customer._id),
        label: customer.name,
        phone: customer.phone || "",
        email: customer.email || "",
        customerType: customer.customerType || "regular",
        gstStatus: customer.gstin ? "gst" : "non_gst",
      })),
    ],
  };

  return data;
};

const getRetailAnalyticsDashboard = async ({
  datePreset,
  from,
  to,
  productId,
  category,
  customerId,
  paymentMethod,
  salesPeriod,
} = {}) => {
  const range = parseDashboardDateRange({ datePreset, from, to });
  const normalizedSalesPeriod = normalizeSalesPeriod(salesPeriod);
  const productScope = buildProductScopeQuery({ productId, category });
  const scopeProducts = await Product.find(productScope.query)
    .select("_id name sku category stock sellingPrice price costPrice reorderPoint status")
    .sort({ name: 1 });
  const scopedProductIds = scopeProducts.map((product) => product._id);

  const currentOrderMatch = buildOrderMatch({
    range,
    customerId,
    paymentMethod,
  });
  const previousOrderMatch = buildOrderMatch({
    range: {
      startDate: range.previousStartDate,
      endDate: range.previousEndDate,
    },
    customerId,
    paymentMethod,
  });

  const itemProductIds = productScope.hasScopedProducts ? scopedProductIds : null;

  const [
    currentOrderRows,
    previousOrderRows,
    currentProductMetrics,
    previousProductMetrics,
    gstByRate,
  ] = await Promise.all([
    getOrderContributionRows({ orderMatch: currentOrderMatch, productIds: itemProductIds }),
    getOrderContributionRows({ orderMatch: previousOrderMatch, productIds: itemProductIds }),
    getProductMetricRows({ orderMatch: currentOrderMatch, productIds: itemProductIds }),
    getProductMetricRows({ orderMatch: previousOrderMatch, productIds: itemProductIds }),
    getGstRateBreakdown({ orderMatch: currentOrderMatch, productIds: itemProductIds }),
  ]);

  const currentRevenue = sumOrderMetric(currentOrderRows, "revenue");
  const currentProfit = sumOrderMetric(currentOrderRows, "profit");
  const currentOrders = currentOrderRows.length;
  const currentAverageOrderValue =
    currentOrders > 0 ? roundCurrency(currentRevenue / currentOrders) : 0;
  const previousRevenue = sumOrderMetric(previousOrderRows, "revenue");
  const previousProfit = sumOrderMetric(previousOrderRows, "profit");
  const previousOrders = previousOrderRows.length;
  const previousAverageOrderValue =
    previousOrders > 0 ? roundCurrency(previousRevenue / previousOrders) : 0;

  const salesTrendPoints = buildSalesTrend({
    rows: currentOrderRows,
    startDate: range.startDate,
    endDate: range.endDate,
    period: normalizedSalesPeriod,
  });

  const previousProductMetricsMap = new Map(
    previousProductMetrics.map((metric) => [String(metric.productId), metric])
  );
  const productAnalytics = buildProductAnalytics({
    scopeProducts,
    metricRows: currentProductMetrics,
  });
  const topProductsByRevenue = productAnalytics
    .filter((product) => product.unitsSold > 0 || product.revenue > 0)
    .slice(0, 8);
  const topProductsByQuantity = productAnalytics
    .filter((product) => product.unitsSold > 0 || product.revenue > 0)
    .slice()
    .sort(
      (left, right) =>
        right.unitsSold - left.unitsSold ||
        right.revenue - left.revenue ||
        String(left.name || "").localeCompare(String(right.name || ""))
    )
    .slice(0, 8);
  const topProduct = topProductsByRevenue[0] || null;
  const previousTopProductRevenue = topProduct
    ? roundCurrency(
        previousProductMetricsMap.get(String(topProduct.productId))?.revenue || 0
      )
    : 0;

  const customerInsights = buildCustomerInsights(currentOrderRows);
  const previousCustomerInsights = buildCustomerInsights(previousOrderRows);
  const gstTotals = gstByRate.reduce(
    (acc, row) => {
      acc.taxableValue += toNumber(row.taxableValue, 0);
      acc.totalGst += toNumber(row.gstAmount, 0);
      acc.cgstAmount += toNumber(row.cgstAmount, 0);
      acc.sgstAmount += toNumber(row.sgstAmount, 0);
      acc.igstAmount += toNumber(row.igstAmount, 0);
      return acc;
    },
    {
      taxableValue: 0,
      totalGst: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    }
  );

  const inventoryInsights = buildInventoryInsights(productAnalytics);
  const categoryDistribution = buildCategoryDistribution(productAnalytics);
  const recentOrders = buildRecentOrders(currentOrderRows);

  return {
    appliedFilters: {
      datePreset: range.datePreset,
      from: range.startDate,
      to: range.endDate,
      productId: productScope.normalizedProductId,
      category: productScope.normalizedCategory,
      customerId: String(customerId || "").trim(),
      paymentMethod: normalizePaymentMethod(paymentMethod),
      salesPeriod: normalizedSalesPeriod,
    },
    comparisonPeriod: {
      from: range.previousStartDate,
      to: range.previousEndDate,
      label: `${formatDateLabel(range.previousStartDate)} to ${formatDateLabel(
        range.previousEndDate
      )}`,
    },
    kpis: {
      totalRevenue: {
        value: currentRevenue,
        changePercent: calculateChangePercent(currentRevenue, previousRevenue),
        sparkline: buildSparkline(salesTrendPoints, "revenue"),
      },
      totalProfit: {
        value: currentProfit,
        changePercent: calculateChangePercent(currentProfit, previousProfit),
        sparkline: buildSparkline(salesTrendPoints, "profit"),
      },
      totalOrders: {
        value: currentOrders,
        changePercent: calculateChangePercent(currentOrders, previousOrders),
        sparkline: buildSparkline(salesTrendPoints, "orders"),
      },
      averageOrderValue: {
        value: currentAverageOrderValue,
        changePercent: calculateChangePercent(
          currentAverageOrderValue,
          previousAverageOrderValue
        ),
        sparkline: buildSparkline(salesTrendPoints, "averageOrderValue"),
      },
      topProduct: {
        name: topProduct?.name || "No top product",
        sku: topProduct?.sku || "",
        value: roundCurrency(topProduct?.revenue || 0),
        unitsSold: roundCurrency(topProduct?.unitsSold || 0),
        changePercent: calculateChangePercent(
          topProduct?.revenue || 0,
          previousTopProductRevenue
        ),
        sparkline: buildTopProductSparkline(topProductsByRevenue),
      },
      repeatCustomerRate: {
        value: customerInsights.summary.repeatCustomerRate,
        repeatCustomers: customerInsights.summary.repeatCustomers,
        namedCustomerCount: customerInsights.summary.namedCustomerCount,
        changePercent: calculateChangePercent(
          customerInsights.summary.repeatCustomerRate,
          previousCustomerInsights.summary.repeatCustomerRate
        ),
        sparkline: customerInsights.topCustomers
          .slice(0, 8)
          .map((customer) => roundCurrency(customer.totalSpend || 0)),
      },
    },
    salesTrend: {
      period: normalizedSalesPeriod,
      points: salesTrendPoints,
    },
    topProducts: {
      items: topProductsByRevenue,
      totalTrackedProducts: productAnalytics.length,
    },
    topProductsByRevenue,
    topProductsByQuantity,
    categoryDistribution,
    recentOrders,
    productAnalytics: {
      items: productAnalytics,
    },
    customerInsights,
    inventoryInsights,
    gst: {
      totals: {
        taxableValue: roundCurrency(gstTotals.taxableValue),
        totalGst: roundCurrency(gstTotals.totalGst),
        cgstAmount: roundCurrency(gstTotals.cgstAmount),
        sgstAmount: roundCurrency(gstTotals.sgstAmount),
        igstAmount: roundCurrency(gstTotals.igstAmount),
      },
      byRate: gstByRate,
    },
    meta: {
      hasSalesData: currentOrderRows.length > 0,
      orderCount: currentOrderRows.length,
      productCount: productAnalytics.length,
    },
  };
};

module.exports = {
  getReportFilterOptions,
  getRetailAnalyticsDashboard,
};
