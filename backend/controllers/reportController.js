const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const reportingDashboardService = require("../services/reportingDashboardService");
const reportingService = require("../services/reportingService");

const COMPLETED_ORDER_FILTER = {
  $or: [{ status: "completed" }, { status: { $exists: false } }],
};

const STOCK_STATUS_THRESHOLD = 10;

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const getSummary = async (req, res) => {
  try {
    const [salesSummary] = await Order.aggregate([
      { $match: COMPLETED_ORDER_FILTER },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
          totalProfit: {
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
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const totalProducts = await Product.countDocuments();

    const lowStockProducts = await Product.find({
      $expr: {
        $lte: [
          { $ifNull: ["$stock", 0] },
          {
            $cond: [
              { $gt: [{ $ifNull: ["$reorderPoint", 0] }, 0] },
              { $ifNull: ["$reorderPoint", 0] },
              STOCK_STATUS_THRESHOLD,
            ],
          },
        ],
      },
    })
      .select("_id name sku category stock reorderPoint")
      .sort({ stock: 1, name: 1 });

    return sendSuccess(res, {
      message: "Summary report fetched successfully.",
      data: {
        totalSales: roundCurrency(salesSummary?.totalSales || 0),
        totalProfit: roundCurrency(salesSummary?.totalProfit || 0),
        totalOrders: salesSummary?.totalOrders || 0,
        totalProducts,
        lowStockProducts,
      },
    });
  } catch (error) {
    console.error("Get summary report error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching summary report." });
  }
};

const getSalesTrend = async (req, res) => {
  try {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    const startDate = new Date(todayUtc);
    startDate.setUTCDate(startDate.getUTCDate() - 6);

    const trendData = await Order.aggregate([
      {
        $match: {
          ...COMPLETED_ORDER_FILTER,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          total: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const totalsByDate = new Map(trendData.map((entry) => [entry._id, entry.total]));
    const salesTrend = [];

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + i);
      const dateKey = date.toISOString().split("T")[0];

      salesTrend.push({
        date: dateKey,
        total: roundCurrency(totalsByDate.get(dateKey) || 0),
      });
    }

    return sendSuccess(res, {
      message: "Sales trend fetched successfully.",
      data: salesTrend,
    });
  } catch (error) {
    console.error("Get sales trend report error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching sales trend report." });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const topProducts = await Order.aggregate([
      { $match: COMPLETED_ORDER_FILTER },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalSold: { $sum: "$items.quantity" },
          revenue: {
            $sum: {
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
          },
          profit: {
            $sum: {
              $ifNull: [
                "$items.profitAmount",
                {
                  $subtract: [
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
      { $sort: { totalSold: -1, _id: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          name: "$_id",
          totalSold: 1,
          revenue: { $round: ["$revenue", 2] },
          profit: { $round: ["$profit", 2] },
        },
      },
    ]);

    return sendSuccess(res, {
      message: "Top products fetched successfully.",
      data: topProducts,
    });
  } catch (error) {
    console.error("Get top products report error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching top products report." });
  }
};

const getProductAnalytics = async (req, res) => {
  try {
    const productMetrics = await Order.aggregate([
      { $match: COMPLETED_ORDER_FILTER },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          totalSoldUnits: { $sum: { $ifNull: ["$items.quantity", 0] } },
          revenueGenerated: {
            $sum: {
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
          },
          profitGenerated: {
            $sum: {
              $ifNull: [
                "$items.profitAmount",
                {
                  $subtract: [
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
    ]);

    const metricMap = new Map(
      productMetrics
        .filter((metric) => mongoose.Types.ObjectId.isValid(metric._id))
        .map((metric) => [String(metric._id), metric])
    );

    const products = await Product.find({}).select(
      "_id name sku category stock sellingPrice price costPrice reorderPoint"
    );

    const analytics = products
      .map((product) => {
        const metric = metricMap.get(String(product._id));
        const stock = Number(product.stock ?? 0);
        const totalSoldUnits = Number(metric?.totalSoldUnits || 0);

        return {
          productId: product._id,
          name: product.name,
          sku: product.sku || "",
          category: product.category || "",
          stock,
          sellingPrice: roundCurrency(product.sellingPrice ?? product.price ?? 0),
          costPrice: roundCurrency(product.costPrice ?? 0),
          totalSoldUnits,
          revenueGenerated: roundCurrency(metric?.revenueGenerated || 0),
          profitGenerated: roundCurrency(metric?.profitGenerated || 0),
          stockTurnoverRate:
            totalSoldUnits <= 0
              ? 0
              : roundCurrency(totalSoldUnits / Math.max((stock + totalSoldUnits) / 2, 1)),
        };
      })
      .sort((a, b) => b.revenueGenerated - a.revenueGenerated || a.name.localeCompare(b.name));

    return sendSuccess(res, {
      message: "Product analytics fetched successfully.",
      data: analytics,
    });
  } catch (error) {
    console.error("Get product analytics report error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching product analytics." });
  }
};

const getReportFilterOptions = asyncHandler(async (req, res) => {
  const data = await reportingDashboardService.getReportFilterOptions();

  return sendSuccess(res, {
    message: "Report filter options fetched successfully.",
    data,
  });
});

const getRetailAnalyticsDashboard = asyncHandler(async (req, res) => {
  const data = await reportingDashboardService.getRetailAnalyticsDashboard({
    datePreset: req.query?.datePreset,
    from: req.query?.from,
    to: req.query?.to,
    productId: req.query?.productId,
    category: req.query?.category,
    customerId: req.query?.customerId,
    paymentMethod: req.query?.paymentMethod,
    salesPeriod: req.query?.salesPeriod,
  });

  return sendSuccess(res, {
    message: "Retail analytics dashboard fetched successfully.",
    data,
  });
});

const getRetailBusinessReports = asyncHandler(async (req, res) => {
  const data = await reportingService.getRetailBusinessReports({
    datePreset: req.query?.datePreset,
    from: req.query?.from,
    to: req.query?.to,
    productId: req.query?.productId,
    category: req.query?.category,
    customerId: req.query?.customerId,
    paymentMethod: req.query?.paymentMethod,
  });

  return sendSuccess(res, {
    message: "Retail business reports fetched successfully.",
    data,
  });
});

module.exports = {
  getSummary,
  getSalesTrend,
  getTopProducts,
  getProductAnalytics,
  getReportFilterOptions,
  getRetailAnalyticsDashboard,
  getRetailBusinessReports,
};
