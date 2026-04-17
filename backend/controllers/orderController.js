const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const orderService = require("../services/orderService");

const toActorPayload = (user) => ({
  userId: user?._id,
  name: user?.name || "",
  role: user?.role || "",
});

const createOrder = asyncHandler(async (req, res) => {
  const order = await orderService.createOrder({
    ...req.body,
    performedBy: toActorPayload(req.user),
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: "Order created successfully.",
    data: order,
  });
});

const getOrders = asyncHandler(async (req, res) => {
  const orders = await orderService.getOrders(req.query);

  return sendSuccess(res, {
    message: "Orders fetched successfully.",
    data: Array.isArray(orders) ? orders : [],
  });
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);

  return sendSuccess(res, {
    message: "Order fetched successfully.",
    data: order,
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const result = await orderService.updateOrderStatus(req.params.id, req.body?.status, toActorPayload(req.user));

  return sendSuccess(res, {
    message: result.message,
    data: result.order,
  });
});

const getOrderInvoice = asyncHandler(async (req, res) => {
  const invoice = await orderService.getOrderInvoice(req.params.id);

  return sendSuccess(res, {
    message: "Invoice fetched successfully.",
    data: invoice,
  });
});

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderInvoice,
};
