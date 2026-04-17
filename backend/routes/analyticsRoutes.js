const express = require("express");
const {
  getSalesReport,
  getTopSellingProducts,
  getProfitReport,
  getInventoryValuation,
  getLowStockAlerts,
} = require("../controllers/analyticsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin"));
router.get("/sales-report", getSalesReport);
router.get("/top-selling-products", getTopSellingProducts);
router.get("/profit-report", getProfitReport);
router.get("/inventory-valuation", getInventoryValuation);
router.get("/low-stock-alerts", getLowStockAlerts);

module.exports = router;
