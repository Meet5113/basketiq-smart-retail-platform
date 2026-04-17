const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const analyticsService = require("../services/analyticsService");

const getSalesReport = asyncHandler(async (req, res) => {
  const report = await analyticsService.getSalesReport({
    period: req.query?.period,
    from: req.query?.from,
    to: req.query?.to,
  });

  return sendSuccess(res, {
    message: "Sales report fetched successfully.",
    data: report,
  });
});

const getTopSellingProducts = asyncHandler(async (req, res) => {
  const data = await analyticsService.getTopSellingProducts({
    from: req.query?.from,
    to: req.query?.to,
    limit: req.query?.limit,
  });

  return sendSuccess(res, {
    message: "Top selling products fetched successfully.",
    data,
  });
});

const getProfitReport = asyncHandler(async (req, res) => {
  const report = await analyticsService.getProfitReport({
    period: req.query?.period,
    from: req.query?.from,
    to: req.query?.to,
  });

  return sendSuccess(res, {
    message: "Profit report fetched successfully.",
    data: report,
  });
});

const getInventoryValuation = asyncHandler(async (req, res) => {
  const report = await analyticsService.getInventoryValuation();

  return sendSuccess(res, {
    message: "Inventory valuation fetched successfully.",
    data: report,
  });
});

const getLowStockAlerts = asyncHandler(async (req, res) => {
  const alerts = await analyticsService.getLowStockAlerts({
    limit: req.query?.limit,
  });

  return sendSuccess(res, {
    message: "Low stock alerts fetched successfully.",
    data: alerts,
  });
});

module.exports = {
  getSalesReport,
  getTopSellingProducts,
  getProfitReport,
  getInventoryValuation,
  getLowStockAlerts,
};
