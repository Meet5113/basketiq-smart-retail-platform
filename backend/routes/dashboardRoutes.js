const express = require("express");
const {
  getKpiData,
  getChartData,
  getRecentData,
} = require("../controllers/dashboardController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router.get("/kpi", getKpiData);
router.get("/charts", getChartData);
router.get("/recent", getRecentData);

module.exports = router;
