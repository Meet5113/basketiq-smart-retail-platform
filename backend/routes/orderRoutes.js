const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderInvoice,
} = require("../controllers/orderController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, authorizeRoles("admin", "staff"), getOrders);
router.post("/", protect, authorizeRoles("admin", "staff"), createOrder);
router.get("/:id/invoice", protect, authorizeRoles("admin", "staff"), getOrderInvoice);
router.get("/:id", protect, authorizeRoles("admin", "staff"), getOrderById);
router.put("/:id/status", protect, authorizeRoles("admin", "staff"), updateOrderStatus);

module.exports = router;
