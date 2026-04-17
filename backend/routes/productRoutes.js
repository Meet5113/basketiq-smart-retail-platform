const express = require("express");
const {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  updateProductStatus,
  deleteProduct,
} = require("../controllers/productController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, authorizeRoles("admin"), createProduct).get(protect, getProducts);
router.patch("/:id/status", protect, authorizeRoles("admin"), updateProductStatus);
router
  .route("/:id")
  .get(protect, getProductById)
  .put(protect, authorizeRoles("admin"), updateProduct)
  .delete(protect, authorizeRoles("admin"), deleteProduct);

module.exports = router;
