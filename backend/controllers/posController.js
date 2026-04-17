const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const posService = require("../services/posService");

const toActorPayload = (user) => ({
  userId: user?._id,
  name: user?.name || "",
  role: user?.role || "",
});

const getPosSettings = asyncHandler(async (req, res) => {
  const settings = await posService.getPosSettings();

  return sendSuccess(res, {
    message: "POS settings fetched successfully.",
    data: settings,
  });
});

const getCart = asyncHandler(async (req, res) => {
  const cart = await posService.getCart(req.user._id);

  return sendSuccess(res, {
    message: "Cart fetched successfully.",
    data: cart,
  });
});

const addItemToCart = asyncHandler(async (req, res) => {
  const cart = await posService.addItemToCart(req.user._id, req.body);

  return sendSuccess(res, {
    message: "Item added to cart.",
    data: cart,
  });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const cart = await posService.updateCartItem(req.user._id, req.params.productId, req.body);

  return sendSuccess(res, {
    message: "Cart item updated.",
    data: cart,
  });
});

const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await posService.removeCartItem(req.user._id, req.params.productId);

  return sendSuccess(res, {
    message: "Cart item removed.",
    data: cart,
  });
});

const setCartDiscount = asyncHandler(async (req, res) => {
  const cart = await posService.setCartDiscount(req.user._id, req.body);

  return sendSuccess(res, {
    message: "Cart discount updated.",
    data: cart,
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await posService.clearCart(req.user._id);

  return sendSuccess(res, {
    message: "Cart cleared.",
    data: cart,
  });
});

const checkoutCart = asyncHandler(async (req, res) => {
  const order = await posService.checkoutCart(req.user._id, req.body, toActorPayload(req.user));

  return sendSuccess(res, {
    statusCode: 201,
    message: "Checkout completed successfully.",
    data: order,
  });
});

module.exports = {
  getPosSettings,
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  setCartDiscount,
  clearCart,
  checkoutCart,
};
