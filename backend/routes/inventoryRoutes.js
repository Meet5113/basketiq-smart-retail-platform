const express = require("express");
const {
  getCurrentStock,
  getLowStock,
  getStockHistory,
  adjustStock,
} = require("../controllers/inventoryController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin", "staff"));
router.get("/current", getCurrentStock);
router.get("/low-stock", getLowStock);
router.get("/history", getStockHistory);
router.post("/adjustments", adjustStock);

module.exports = router;
