const express = require("express");
const {
  getPosSettings,
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  setCartDiscount,
  clearCart,
  checkoutCart,
} = require("../controllers/posController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("admin", "staff"));

router.get("/settings", getPosSettings);
router.get("/cart", getCart);
router.post("/cart/items", addItemToCart);
router.put("/cart/items/:productId", updateCartItem);
router.delete("/cart/items/:productId", removeCartItem);
router.put("/cart/discount", setCartDiscount);
router.delete("/cart", clearCart);
router.post("/checkout", checkoutCart);

module.exports = router;
