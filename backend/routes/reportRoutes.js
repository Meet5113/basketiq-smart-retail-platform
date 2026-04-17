const express = require("express");
const {
  getSummary,
  getSalesTrend,
  getTopProducts,
  getProductAnalytics,
  getReportFilterOptions,
  getRetailAnalyticsDashboard,
  getRetailBusinessReports,
} = require("../controllers/reportController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/summary", protect, authorizeRoles("admin"), getSummary);
router.get("/sales-trend", protect, authorizeRoles("admin"), getSalesTrend);
router.get("/top-products", protect, authorizeRoles("admin"), getTopProducts);
router.get("/product-analytics", protect, authorizeRoles("admin"), getProductAnalytics);
router.get("/filter-options", protect, authorizeRoles("admin"), getReportFilterOptions);
router.get("/dashboard", protect, authorizeRoles("admin"), getRetailAnalyticsDashboard);
router.get("/business", protect, authorizeRoles("admin"), getRetailBusinessReports);

module.exports = router;
