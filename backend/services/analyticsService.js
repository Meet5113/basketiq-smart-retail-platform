const Order = require("../models/Order");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");

const COMPLETED_ORDER_FILTER = {
  $or: [{ status: "completed" }, { status: { $exists: false } }],
};

const PERIODS = ["daily", "weekly", "monthly"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePeriod = (value) => {
  const normalized = String(value || "daily").toLowerCase();
  return PERIODS.includes(normalized) ? normalized : "daily";
};

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const parseDateRange = ({ from, to, period = "daily" } = {}) => {
  const normalizedPeriod = normalizePeriod(period);

  let startDate = from ? new Date(from) : null;
  let endDate = to ? new Date(to) : null;

  if (startDate && Number.isNaN(startDate.getTime())) {
    throw new ApiError(400, "Invalid from date.", "VALIDATION_ERROR");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new ApiError(400, "Invalid to date.", "VALIDATION_ERROR");
  }

  if (!endDate) {
    endDate = new Date();
  }

  if (!startDate) {
    startDate = new Date(endDate);
    if (normalizedPeriod === "daily") {
      startDate.setUTCDate(startDate.getUTCDate() - 29);
    } else if (normalizedPeriod === "weekly") {
      startDate.setUTCDate(startDate.getUTCDate() - 83);
    } else {
      startDate.setUTCMonth(startDate.getUTCMonth() - 11);
    }
  }

  if (startDate > endDate) {
    throw new ApiError(400, "`from` date must be before `to` date.", "VALIDATION_ERROR");
  }

  return {
    period: normalizedPeriod,
    startDate,
    endDate,
  };
};

const getSalesGroupId = (period) => {
  if (period === "weekly") {
    return {
      year: { $isoWeekYear: "$createdAt" },
      week: { $isoWeek: "$createdAt" },
    };
  }

  if (period === "monthly") {
    return {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
    };
  }

  return {
    date: {
      $dateToString: {
        format: "%Y-%m-%d",
        date: "$createdAt",
        timezone: "UTC",
      },
    },
  };
};

const getSalesLabelProjection = (period) => {
  if (period === "weekly") {
    return {
      label: {
        $concat: [
          { $toString: "$_id.year" },
          "-W",
          {
            $cond: [
              { $lt: ["$_id.week", 10] },
              { $concat: ["0", { $toString: "$_id.week" }] },
              { $toString: "$_id.week" },
            ],
          },
        ],
      },
    };
  }

  if (period === "monthly") {
    return {
      label: {
        $concat: [
          { $toString: "$_id.year" },
          "-",
          {
            $cond: [
              { $lt: ["$_id.month", 10] },
              { $concat: ["0", { $toString: "$_id.month" }] },
              { $toString: "$_id.month" },
            ],
          },
        ],
      },
    };
  }

  return {
    label: "$_id.date",
  };
};

const getSalesReport = async ({ period, from, to } = {}) => {
  const dateRange = parseDateRange({ period, from, to });
  const groupId = getSalesGroupId(dateRange.period);
  const labelProjection = getSalesLabelProjection(dateRange.period);

  const [trend, totalsRow] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          ...COMPLETED_ORDER_FILTER,
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: groupId,
          orderCount: { $sum: 1 },
          netSales: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
          taxableSales: { $sum: { $ifNull: ["$taxableAmount", "$totalAmount"] } },
          taxCollected: { $sum: { $ifNull: ["$gstAmount", 0] } },
          discountGiven: { $sum: { $ifNull: ["$discountAmount", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          ...labelProjection,
          orderCount: 1,
          netSales: { $round: ["$netSales", 2] },
          taxableSales: { $round: ["$taxableSales", 2] },
          taxCollected: { $round: ["$taxCollected", 2] },
          discountGiven: { $round: ["$discountGiven", 2] },
        },
      },
      { $sort: { label: 1 } },
    ]),
    Order.aggregate([
      {
        $match: {
          ...COMPLETED_ORDER_FILTER,
          createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
        },
      },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          netSales: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
          taxableSales: { $sum: { $ifNull: ["$taxableAmount", "$totalAmount"] } },
          taxCollected: { $sum: { $ifNull: ["$gstAmount", 0] } },
          discountGiven: { $sum: { $ifNull: ["$discountAmount", 0] } },
        },
      },
    ]),
  ]);

  const totals = totalsRow[0] || {
    orderCount: 0,
    netSales: 0,
    taxableSales: 0,
    taxCollected: 0,
    discountGiven: 0,
  };

  return {
    period: dateRange.period,
    from: dateRange.startDate,
    to: dateRange.endDate,
    totals: {
      orderCount: totals.orderCount || 0,
      netSales: roundCurrency(totals.netSales || 0),
      taxableSales: roundCurrency(totals.taxableSales || 0),
      taxCollected: roundCurrency(totals.taxCollected || 0),
      discountGiven: roundCurrency(totals.discountGiven || 0),
    },
    trend,
  };
};

const getTopSellingProducts = async ({ from, to, limit = 10 } = {}) => {
  const dateRange = parseDateRange({ from, to, period: "daily" });
  const normalizedLimit = Math.min(100, Math.max(1, toNumber(limit, 10)));

  return Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" },
        sku: { $first: "$items.sku" },
        unitsSold: { $sum: { $ifNull: ["$items.quantity", 0] } },
        grossSales: {
          $sum: {
            $ifNull: [
              "$items.lineAmountWithTax",
              { $ifNull: ["$items.finalLineTotal", 0] },
            ],
          },
        },
        taxableSales: {
          $sum: {
            $ifNull: ["$items.taxableAmount", { $ifNull: ["$items.finalLineTotal", 0] }],
          },
        },
        taxAmount: { $sum: { $ifNull: ["$items.taxAmount", 0] } },
        profit: {
          $sum: {
            $ifNull: [
              "$items.profitAmount",
              {
                $subtract: [
                  { $ifNull: ["$items.finalLineTotal", 0] },
                  {
                    $multiply: [
                      { $ifNull: ["$items.costPrice", 0] },
                      { $ifNull: ["$items.quantity", 0] },
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    },
    { $sort: { unitsSold: -1, grossSales: -1, name: 1 } },
    { $limit: normalizedLimit },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: 1,
        sku: 1,
        unitsSold: 1,
        grossSales: { $round: ["$grossSales", 2] },
        taxableSales: { $round: ["$taxableSales", 2] },
        taxAmount: { $round: ["$taxAmount", 2] },
        profit: { $round: ["$profit", 2] },
      },
    },
  ]);
};

const getProfitReport = async ({ period, from, to } = {}) => {
  const dateRange = parseDateRange({ period, from, to });
  const groupId = getSalesGroupId(dateRange.period);
  const labelProjection = getSalesLabelProjection(dateRange.period);

  const trend = await Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: { $gte: dateRange.startDate, $lte: dateRange.endDate },
      },
    },
    {
      $group: {
        _id: groupId,
        revenue: { $sum: { $ifNull: ["$taxableAmount", "$totalAmount"] } },
        costOfGoodsSold: { $sum: { $ifNull: ["$costAmount", 0] } },
        grossProfit: {
          $sum: {
            $ifNull: [
              "$profitAmount",
              {
                $subtract: [
                  { $ifNull: ["$taxableAmount", { $ifNull: ["$totalAmount", 0] }] },
                  { $ifNull: ["$costAmount", 0] },
                ],
              },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        ...labelProjection,
        revenue: { $round: ["$revenue", 2] },
        costOfGoodsSold: { $round: ["$costOfGoodsSold", 2] },
        grossProfit: { $round: ["$grossProfit", 2] },
        marginPercent: {
          $round: [
            {
              $cond: [
                { $lte: ["$revenue", 0] },
                0,
                { $multiply: [{ $divide: ["$grossProfit", "$revenue"] }, 100] },
              ],
            },
            2,
          ],
        },
      },
    },
    { $sort: { label: 1 } },
  ]);

  const totals = trend.reduce(
    (acc, row) => {
      acc.revenue += toNumber(row.revenue, 0);
      acc.costOfGoodsSold += toNumber(row.costOfGoodsSold, 0);
      acc.grossProfit += toNumber(row.grossProfit, 0);
      return acc;
    },
    {
      revenue: 0,
      costOfGoodsSold: 0,
      grossProfit: 0,
    }
  );

  const marginPercent =
    totals.revenue > 0 ? roundCurrency((totals.grossProfit / totals.revenue) * 100) : 0;

  return {
    period: dateRange.period,
    from: dateRange.startDate,
    to: dateRange.endDate,
    totals: {
      revenue: roundCurrency(totals.revenue),
      costOfGoodsSold: roundCurrency(totals.costOfGoodsSold),
      grossProfit: roundCurrency(totals.grossProfit),
      marginPercent,
    },
    trend,
  };
};

const getInventoryValuation = async () => {
  const [items, totals] = await Promise.all([
    Product.aggregate([
      {
        $addFields: {
          inventoryValue: { $multiply: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$costPrice", 0] }] },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: { $ifNull: ["$name", "Unknown Product"] },
          sku: { $ifNull: ["$sku", ""] },
          quantity: { $round: [{ $ifNull: ["$stock", 0] }, 2] },
          inventoryValue: { $round: ["$inventoryValue", 2] },
          averageUnitCost: {
            $round: [
              {
                $cond: [
                  { $lte: [{ $ifNull: ["$stock", 0] }, 0] },
                  0,
                  { $divide: ["$inventoryValue", { $ifNull: ["$stock", 0] }] },
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { inventoryValue: -1, name: 1 } },
    ]),
    Product.aggregate([
      {
        $group: {
          _id: null,
          totalUnits: { $sum: { $ifNull: ["$stock", 0] } },
          totalInventoryValue: {
            $sum: { $multiply: [{ $ifNull: ["$stock", 0] }, { $ifNull: ["$costPrice", 0] }] },
          },
        },
      },
    ]),
  ]);

  const total = totals[0] || {
    totalUnits: 0,
    totalInventoryValue: 0,
  };

  return {
    totals: {
      totalUnits: roundCurrency(total.totalUnits || 0),
      totalInventoryValue: roundCurrency(total.totalInventoryValue || 0),
    },
    items,
  };
};

const getLowStockAlerts = async ({ limit = 50 } = {}) => {
  const normalizedLimit = Math.min(200, Math.max(1, toNumber(limit, 50)));

  return Product.aggregate([
    {
      $addFields: {
        currentStock: { $ifNull: ["$stock", 0] },
        threshold: {
          $cond: [
            { $gt: [{ $ifNull: ["$reorderPoint", 0] }, 0] },
            { $ifNull: ["$reorderPoint", 0] },
            10,
          ],
        },
      },
    },
    {
      $match: {
        $expr: { $lte: ["$currentStock", "$threshold"] },
      },
    },
    {
      $project: {
        _id: 0,
        productId: "$_id",
        name: 1,
        sku: 1,
        category: 1,
        currentStock: 1,
        threshold: 1,
        shortage: { $round: [{ $subtract: ["$threshold", "$currentStock"] }, 2] },
        costPrice: { $ifNull: ["$costPrice", 0] },
      },
    },
    {
      $addFields: {
        estimatedReorderValue: {
          $round: [{ $multiply: [{ $max: ["$shortage", 0] }, { $ifNull: ["$costPrice", 0] }] }, 2],
        },
      },
    },
    { $sort: { currentStock: 1, threshold: -1, name: 1 } },
    { $limit: normalizedLimit },
  ]);
};

module.exports = {
  getSalesReport,
  getTopSellingProducts,
  getProfitReport,
  getInventoryValuation,
  getLowStockAlerts,
};
