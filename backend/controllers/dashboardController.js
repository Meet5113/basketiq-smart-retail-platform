const asyncHandler = require("../middleware/asyncHandler");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { sendSuccess } = require("../utils/apiResponse");

const COMPLETED_ORDER_FILTER = {
  $or: [{ status: "completed" }, { status: { $exists: false } }],
};

const VALID_RANGES = ["today", "week", "month"];

const roundToTwo = (value) => Number((Number(value) || 0).toFixed(2));
const addUtcDays = (input, days) => {
  const date = new Date(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};
const formatDateKey = (input) => {
  const date = new Date(input);
  return date.toISOString().split("T")[0];
};
const formatChartLabel = (input) =>
  new Date(input).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

const parseRange = (range) => (VALID_RANGES.includes(range) ? range : "week");

const getDateRange = (range) => {
  const normalizedRange = parseRange(range);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCHours(0, 0, 0, 0);

  if (normalizedRange === "week") {
    startDate.setUTCDate(startDate.getUTCDate() - 6);
  } else if (normalizedRange === "month") {
    startDate.setUTCDate(startDate.getUTCDate() - 29);
  }

  return { normalizedRange, startDate, endDate };
};

const getPreviousRange = (startDate, endDate) => {
  const durationMs = endDate.getTime() - startDate.getTime();
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(previousEndDate.getTime() - durationMs);

  return { previousStartDate, previousEndDate };
};

const calculateChangePercent = (currentValue, previousValue) => {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }

  return roundToTwo(((currentValue - previousValue) / previousValue) * 100);
};

const getLowStockProducts = async () =>
  Product.find({
    $expr: {
      $lte: [
        "$stock",
        {
          $cond: [
            { $gt: [{ $ifNull: ["$reorderPoint", 0] }, 0] },
            { $ifNull: ["$reorderPoint", 0] },
            10,
          ],
        },
      ],
    },
  })
    .select("_id name sku category stock reorderPoint")
    .sort({ stock: 1, name: 1 });

const aggregateRevenueAndOrders = async (startDate, endDate) => {
  const [summary] = await Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
        totalOrders: { $sum: 1 },
      },
    },
  ]);

  return {
    totalRevenue: roundToTwo(summary?.totalRevenue || 0),
    totalOrders: summary?.totalOrders || 0,
  };
};

const aggregateProductCount = async (startDate, endDate) =>
  Product.countDocuments({
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  });

const itemRevenueExpression = {
  $ifNull: [
    "$items.lineAmountWithTax",
    {
      $ifNull: [
        "$items.finalLineTotal",
        {
          $multiply: [
            { $ifNull: ["$items.price", 0] },
            { $ifNull: ["$items.quantity", 0] },
          ],
        },
      ],
    },
  ],
};

const buildRevenueTrend = async (startDate, endDate, range) => {
  const groupFormat = range === "month" ? "%Y-%m-%d" : "%Y-%m-%d";

  const trendRows = await Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: groupFormat,
            date: "$createdAt",
            timezone: "UTC",
          },
        },
        total: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
      },
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        total: { $round: ["$total", 2] },
      },
    },
    { $sort: { date: 1 } },
  ]);

  const totalsByDate = new Map(
    trendRows.map((row) => [String(row.date), roundToTwo(row.total)])
  );
  const points = [];
  let cursor = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
  const finalCursor = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  while (cursor <= finalCursor) {
    const dateKey = formatDateKey(cursor);
    points.push({
      date: dateKey,
      label: formatChartLabel(cursor),
      total: roundToTwo(totalsByDate.get(dateKey) || 0),
    });
    cursor = addUtcDays(cursor, 1);
  }

  return points;
};

const buildTopProductsByRevenue = async (startDate, endDate) =>
  Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" },
        revenue: { $sum: itemRevenueExpression },
      },
    },
    { $sort: { revenue: -1, name: 1 } },
    { $limit: 6 },
    {
      $project: {
        _id: 0,
        name: 1,
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);

const buildTopProductsByUnits = async (startDate, endDate) =>
  Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.productId",
        name: { $first: "$items.name" },
        units: { $sum: { $ifNull: ["$items.quantity", 0] } },
      },
    },
    { $sort: { units: -1, name: 1 } },
    { $limit: 6 },
    {
      $project: {
        _id: 0,
        name: 1,
        units: 1,
      },
    },
  ]);

const buildCategoryDistribution = async (startDate, endDate) => {
  const rows = await Order.aggregate([
    {
      $match: {
        ...COMPLETED_ORDER_FILTER,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "products",
        localField: "items.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    {
      $addFields: {
        itemCategory: {
          $let: {
            vars: {
              productCategory: {
                $ifNull: [{ $arrayElemAt: ["$product.category", 0] }, ""],
              },
            },
            in: {
              $cond: [
                { $eq: ["$$productCategory", ""] },
                "Uncategorized",
                "$$productCategory",
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: "$itemCategory",
        revenue: { $sum: itemRevenueExpression },
      },
    },
    { $sort: { revenue: -1, _id: 1 } },
    {
      $project: {
        _id: 0,
        category: "$_id",
        revenue: { $round: ["$revenue", 2] },
      },
    },
  ]);

  const totalRevenue = rows.reduce(
    (sum, row) => sum + Number(row.revenue || 0),
    0
  );

  return rows.map((row) => ({
    ...row,
    percentage:
      totalRevenue > 0 ? roundToTwo((Number(row.revenue || 0) / totalRevenue) * 100) : 0,
  }));
};

const getKpiData = asyncHandler(async (req, res) => {
  const { normalizedRange, startDate, endDate } = getDateRange(req.query?.range);
  const { previousStartDate, previousEndDate } = getPreviousRange(startDate, endDate);

  const [currentSummary, previousSummary, totalProducts, currentProductAdds, previousProductAdds, lowStockProducts] =
    await Promise.all([
      aggregateRevenueAndOrders(startDate, endDate),
      aggregateRevenueAndOrders(previousStartDate, previousEndDate),
      Product.countDocuments(),
      aggregateProductCount(startDate, endDate),
      aggregateProductCount(previousStartDate, previousEndDate),
      getLowStockProducts(),
    ]);

  return sendSuccess(res, {
    message: "Dashboard KPI data fetched successfully.",
    data: {
      range: normalizedRange,
      totalRevenue: currentSummary.totalRevenue,
      totalOrders: currentSummary.totalOrders,
      totalProducts,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
      growth: {
        revenue: calculateChangePercent(currentSummary.totalRevenue, previousSummary.totalRevenue),
        orders: calculateChangePercent(currentSummary.totalOrders, previousSummary.totalOrders),
        products: calculateChangePercent(currentProductAdds, previousProductAdds),
        lowStock: 0,
      },
      weeklyComparison: {
        currentWeekRevenue: currentSummary.totalRevenue,
        previousWeekRevenue: previousSummary.totalRevenue,
        revenueChangePercent: calculateChangePercent(currentSummary.totalRevenue, previousSummary.totalRevenue),
        currentWeekOrders: currentSummary.totalOrders,
        previousWeekOrders: previousSummary.totalOrders,
        ordersChangePercent: calculateChangePercent(currentSummary.totalOrders, previousSummary.totalOrders),
      },
    },
  });
});

const getChartData = asyncHandler(async (req, res) => {
  const { normalizedRange, startDate, endDate } = getDateRange(req.query?.range);

  const [revenueTrend, topProductsByRevenue, topProductsByUnits, categoryDistribution] = await Promise.all([
    buildRevenueTrend(startDate, endDate, normalizedRange),
    buildTopProductsByRevenue(startDate, endDate),
    buildTopProductsByUnits(startDate, endDate),
    buildCategoryDistribution(startDate, endDate),
  ]);

  return sendSuccess(res, {
    message: "Dashboard chart data fetched successfully.",
    data: {
      range: normalizedRange,
      revenueTrend,
      topProductsByRevenue,
      topProductsByUnits,
      categoryDistribution,
    },
  });
});

const getRecentData = asyncHandler(async (req, res) => {
  const { startDate, endDate } = getDateRange(req.query?.range);

  const recentOrders = await Order.find({
    ...COMPLETED_ORDER_FILTER,
    createdAt: {
      $gte: startDate,
      $lte: endDate,
    },
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .select("_id invoiceNumber finalAmount totalAmount createdAt customerName status");

  return sendSuccess(res, {
    message: "Dashboard recent activity fetched successfully.",
    data: {
      recentOrders: recentOrders.map((order) => ({
        id: order._id,
        invoiceNumber: order.invoiceNumber || "",
        customerName: order.customerName || "Walk-in Customer",
        amount: roundToTwo(order.finalAmount || order.totalAmount || 0),
        status: order.status || "completed",
        date: order.createdAt,
      })),
    },
  });
});

module.exports = {
  getKpiData,
  getChartData,
  getRecentData,
};
