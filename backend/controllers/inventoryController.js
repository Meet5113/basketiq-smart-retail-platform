const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const inventoryService = require("../services/inventoryService");
const settingsService = require("../services/settingsService");

const toActorPayload = (user) => ({
  userId: user?._id,
  name: user?.name || "",
  role: user?.role || "",
});

const getCurrentStock = asyncHandler(async (req, res) => {
  const stock = await inventoryService.getCurrentStock({
    productId: req.query?.productId,
  });

  return sendSuccess(res, {
    message: "Current stock fetched successfully.",
    data: stock,
  });
});

const getLowStock = asyncHandler(async (req, res) => {
  const stock = await inventoryService.getLowStock();

  return sendSuccess(res, {
    message: "Low stock items fetched successfully.",
    data: stock,
  });
});

const getStockHistory = asyncHandler(async (req, res) => {
  const history = await inventoryService.getStockHistory({
    productId: req.query?.productId,
    movementType: req.query?.movementType,
    fromDate: req.query?.fromDate,
    toDate: req.query?.toDate,
    page: req.query?.page,
    limit: req.query?.limit,
  });

  return sendSuccess(res, {
    message: "Stock history fetched successfully.",
    data: history.items,
    meta: history.pagination,
  });
});

const adjustStock = asyncHandler(async (req, res) => {
  const runtimeSettings = await settingsService.getPosRuntimeSettings();
  const stock = await inventoryService.adjustStock({
    productId: req.body?.productId,
    action: req.body?.action,
    quantity: req.body?.quantity,
    targetStock: req.body?.targetStock,
    reason: req.body?.reason,
    note: req.body?.note,
    referenceId: req.body?.referenceId,
    performedBy: toActorPayload(req.user),
    allowNegativeStock:
      req.body?.allowNegativeStock !== undefined
        ? Boolean(req.body?.allowNegativeStock)
        : Boolean(runtimeSettings.allowNegativeStock),
  });

  return sendSuccess(res, {
    message: "Inventory stock updated successfully.",
    data: stock,
  });
});

module.exports = {
  getCurrentStock,
  getLowStock,
  getStockHistory,
  adjustStock,
};
