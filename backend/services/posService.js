const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const settingsService = require("./settingsService");
const orderService = require("./orderService");

const DISCOUNT_TYPES = ["flat", "percent"];

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const normalizeDiscountType = (value) => {
  const normalized = String(value || "flat").toLowerCase();
  return DISCOUNT_TYPES.includes(normalized) ? normalized : "flat";
};

const normalizeDiscountValue = (value) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return roundCurrency(parsed);
};

const calculateDiscount = ({ amount, type, value }) => {
  const total = roundCurrency(Math.max(0, Number(amount) || 0));
  const normalizedType = normalizeDiscountType(type);
  const normalizedValue = normalizeDiscountValue(value);

  if (total <= 0 || normalizedValue <= 0) {
    return 0;
  }

  if (normalizedType === "percent") {
    return roundCurrency(total * (Math.min(100, normalizedValue) / 100));
  }

  return roundCurrency(Math.min(normalizedValue, total));
};

const getProductStock = (product) => Math.max(0, toNumber(product?.stock, 0));
const shouldAllowInsufficientStock = async () => {
  const settings = await settingsService.getPosRuntimeSettings();
  return settings.insufficientStockMode === "warn";
};

const ensureQuantity = (quantity) => {
  const parsed = Number(quantity);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, "Quantity must be a positive whole number.", "VALIDATION_ERROR");
  }
  return parsed;
};

const getOrCreateCart = async (userId) => {
  validateObjectId(userId, "user");

  let cart = await Cart.findOne({ userId });

  if (!cart) {
    cart = await Cart.create({
      userId,
      items: [],
      cartDiscountType: "flat",
      cartDiscountValue: 0,
    });
  }

  return cart;
};

const hydrateCart = async (cart) => {
  const { insufficientStockMode } = await settingsService.getPosRuntimeSettings();
  const items = Array.isArray(cart.items) ? cart.items : [];
  const productIds = items.map((item) => item.productId).filter(Boolean);

  const products = await Product.find({ _id: { $in: productIds } }).select(
    "_id name sku status sellingPrice price stock gstRate taxType hsnCode hsnSacCode"
  );
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const enrichedItems = items.map((item) => {
    const product = productMap.get(String(item.productId));
    const price = roundCurrency(toNumber(product?.sellingPrice ?? product?.price, 0));
    const lineTotal = roundCurrency(price * toNumber(item.quantity, 0));
    const lineDiscount = calculateDiscount({
      amount: lineTotal,
      type: item.discountType,
      value: item.discountValue,
    });

    return {
      productId: item.productId,
      quantity: item.quantity,
      discountType: item.discountType,
      discountValue: item.discountValue,
      addedAt: item.addedAt,
      product: product
        ? {
            name: product.name,
            sku: product.sku || "",
            status: product.status,
            sellingPrice: price,
            stock: getProductStock(product),
            gstRate: product.gstRate,
            taxType: product.taxType,
            hsnCode: product.hsnCode || product.hsnSacCode || "",
          }
        : null,
      lineTotal,
      lineDiscountAmount: lineDiscount,
      lineTotalAfterDiscount: roundCurrency(lineTotal - lineDiscount),
      stockAvailable: getProductStock(product),
      isStockSufficient: product ? getProductStock(product) >= toNumber(item.quantity, 0) : false,
    };
  });

  const subtotal = roundCurrency(enrichedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const itemDiscountTotal = roundCurrency(
    enrichedItems.reduce((sum, item) => sum + item.lineDiscountAmount, 0)
  );
  const subtotalAfterItemDiscount = roundCurrency(subtotal - itemDiscountTotal);
  const cartDiscountAmount = calculateDiscount({
    amount: subtotalAfterItemDiscount,
    type: cart.cartDiscountType,
    value: cart.cartDiscountValue,
  });

  const finalSubtotal = roundCurrency(subtotalAfterItemDiscount - cartDiscountAmount);

  return {
    cartId: cart._id,
    userId: cart.userId,
    customerId: cart.customerId,
    items: enrichedItems,
    cartDiscountType: cart.cartDiscountType,
    cartDiscountValue: cart.cartDiscountValue,
    notes: cart.notes || "",
    totals: {
      subtotal,
      itemDiscountTotal,
      cartDiscountAmount,
      subtotalAfterDiscount: finalSubtotal,
    },
    stockPolicy: {
      insufficientStockMode,
    },
    updatedAt: cart.updatedAt,
  };
};

const getPosSettings = async () => settingsService.getPosRuntimeSettings();

const getCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  return hydrateCart(cart);
};

const addItemToCart = async (userId, payload = {}) => {
  const productId = String(payload?.productId || "");
  validateObjectId(productId, "product");

  const quantityToAdd = ensureQuantity(payload?.quantity ?? 1);
  const discountType = normalizeDiscountType(payload?.discountType);
  const discountValue = normalizeDiscountValue(payload?.discountValue);

  const product = await Product.findById(productId);

  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }

  if ((product.status || "active") !== "active") {
    throw new ApiError(400, "Inactive products cannot be added to cart.", "VALIDATION_ERROR");
  }

  const cart = await getOrCreateCart(userId);
  const existingIndex = cart.items.findIndex((item) => String(item.productId) === productId);

  const newQuantity =
    existingIndex === -1
      ? quantityToAdd
      : toNumber(cart.items[existingIndex].quantity, 0) + quantityToAdd;

  if (!(await shouldAllowInsufficientStock()) && getProductStock(product) < newQuantity) {
    throw new ApiError(
      400,
      `Insufficient stock for ${product.name}. Available: ${getProductStock(product)}.`,
      "INSUFFICIENT_STOCK"
    );
  }

  if (existingIndex === -1) {
    cart.items.push({
      productId: product._id,
      quantity: newQuantity,
      discountType,
      discountValue,
      addedAt: new Date(),
    });
  } else {
    cart.items[existingIndex].quantity = newQuantity;
    cart.items[existingIndex].discountType = discountType;
    cart.items[existingIndex].discountValue = discountValue;
  }

  await cart.save();
  return hydrateCart(cart);
};

const updateCartItem = async (userId, productId, payload = {}) => {
  const normalizedProductId = String(productId || "");
  validateObjectId(normalizedProductId, "product");
  const cart = await getOrCreateCart(userId);

  const index = cart.items.findIndex((item) => String(item.productId) === normalizedProductId);
  if (index === -1) {
    throw new ApiError(404, "Product not present in cart.", "NOT_FOUND");
  }

  const product = await Product.findById(normalizedProductId);
  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }

  const newQuantity = ensureQuantity(payload?.quantity);

  if (!(await shouldAllowInsufficientStock()) && getProductStock(product) < newQuantity) {
    throw new ApiError(
      400,
      `Insufficient stock for ${product.name}. Available: ${getProductStock(product)}.`,
      "INSUFFICIENT_STOCK"
    );
  }

  cart.items[index].quantity = newQuantity;

  if (payload.discountType !== undefined) {
    cart.items[index].discountType = normalizeDiscountType(payload.discountType);
  }

  if (payload.discountValue !== undefined) {
    cart.items[index].discountValue = normalizeDiscountValue(payload.discountValue);
  }

  await cart.save();
  return hydrateCart(cart);
};

const removeCartItem = async (userId, productId) => {
  const normalizedProductId = String(productId || "");
  validateObjectId(normalizedProductId, "product");

  const cart = await getOrCreateCart(userId);
  const before = cart.items.length;
  cart.items = cart.items.filter((item) => String(item.productId) !== normalizedProductId);

  if (before === cart.items.length) {
    throw new ApiError(404, "Product not present in cart.", "NOT_FOUND");
  }

  await cart.save();
  return hydrateCart(cart);
};

const setCartDiscount = async (userId, payload = {}) => {
  const cart = await getOrCreateCart(userId);
  cart.cartDiscountType = normalizeDiscountType(payload?.cartDiscountType);
  cart.cartDiscountValue = normalizeDiscountValue(payload?.cartDiscountValue);
  await cart.save();
  return hydrateCart(cart);
};

const clearCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  cart.items = [];
  cart.cartDiscountType = "flat";
  cart.cartDiscountValue = 0;
  cart.notes = "";
  cart.customerId = null;
  await cart.save();
  return hydrateCart(cart);
};

const checkoutCart = async (userId, payload = {}, performedBy = null) => {
  const cart = await getOrCreateCart(userId);

  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty.", "VALIDATION_ERROR");
  }

  const runtimeSettings = await settingsService.getPosRuntimeSettings();
  const customerId = String(
    payload?.customerId ||
      cart.customerId ||
      runtimeSettings.defaultWalkInCustomerId ||
      ""
  );
  if (customerId) {
    validateObjectId(customerId, "customer");

    const customer = await Customer.findById(customerId).select("_id");
    if (!customer) {
      throw new ApiError(404, "Customer not found.", "NOT_FOUND");
    }
  }

  const items = cart.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    discountType: item.discountType,
    discountValue: item.discountValue,
  }));

  const order = await orderService.createOrder({
    items,
    customerId: customerId || undefined,
    paymentMethod: payload?.paymentMethod,
    cartDiscountType:
      payload?.cartDiscountType !== undefined ? payload.cartDiscountType : cart.cartDiscountType,
    cartDiscountValue:
      payload?.cartDiscountValue !== undefined
        ? payload.cartDiscountValue
        : cart.cartDiscountValue,
    splitPayment: payload?.splitPayment,
    supplyType: payload?.supplyType,
    isInterState: payload?.isInterState,
    placeOfSupply: payload?.placeOfSupply,
    performedBy,
  });

  cart.items = [];
  cart.cartDiscountType = "flat";
  cart.cartDiscountValue = 0;
  cart.notes = "";
  cart.customerId = null;
  await cart.save();

  return order;
};

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
