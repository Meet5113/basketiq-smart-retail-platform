const express = require("express");
const {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  deleteCustomer,
} = require("../controllers/customerController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router
  .route("/")
  .post(protect, authorizeRoles("admin", "staff"), createCustomer)
  .get(protect, authorizeRoles("admin", "staff"), getCustomers);

router.get("/:id", protect, authorizeRoles("admin", "staff"), getCustomerById);
router.put("/:id", protect, authorizeRoles("admin", "staff"), updateCustomer);
router.patch("/:id/status", protect, authorizeRoles("admin", "staff"), updateCustomerStatus);
router.delete("/:id", protect, authorizeRoles("admin", "staff"), deleteCustomer);

module.exports = router;
