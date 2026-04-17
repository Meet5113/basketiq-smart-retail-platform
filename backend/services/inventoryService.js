const mongoose = require("mongoose");
const Product = require("../models/Product");
const StockLedger = require("../models/StockLedger");
const ApiError = require("../utils/ApiError");
const { roundCurrency } = require("./gstService");

const STOCK_MOVEMENT_TYPES = [
  "OPENING_STOCK",
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "SALE_DEDUCTION",
];

const STOCK_ACTIONS = ["add", "reduce", "adjust"];
const STOCK_ACTION_MOVEMENT_MAP = {
  add: "STOCK_IN",
  reduce: "STOCK_OUT",
  adjust: "ADJUSTMENT",
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundQuantity = (value) => roundCurrency(toNumber(value, 0));
const roundNonNegative = (value) => roundCurrency(Math.max(0, toNumber(value, 0)));
const normalizeText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const getStockThreshold = (product) => {
  const reorderPoint = roundNonNegative(product?.reorderPoint);
  return reorderPoint > 0 ? reorderPoint : 10;
};

const getStockStatus = (product) => {
  const currentStock = roundQuantity(product?.stock);
  const threshold = getStockThreshold(product);

  if (currentStock <= 0) {
    return "Out of Stock";
  }

  if (currentStock <= threshold) {
    return "Low Stock";
  }

  return "In Stock";
};

const getLastMovementDate = (product) => {
  const history = Array.isArray(product?.stockHistory) ? product.stockHistory : [];

  const latestHistoryDate = history.reduce((latest, entry) => {
    const parsedDate = entry?.date ? new Date(entry.date) : null;

    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      return latest;
    }

    return !latest || parsedDate > latest ? parsedDate : latest;
  }, null);

  return latestHistoryDate || product?.updatedAt || null;
};

const formatStockRow = (product) => ({
  productId: product._id,
  name: product.name,
  sku: product.sku || "",
  category: product.category || "",
  stock: roundQuantity(product.stock),
  unit: String(product.unitType || "unit").trim() || "unit",
  reorderPoint: roundNonNegative(product.reorderPoint),
  lowStockThreshold: getStockThreshold(product),
  stockStatus: getStockStatus(product),
  status: product.status || "active",
  costPrice: roundNonNegative(product.costPrice),
  sellingPrice: roundNonNegative(product.sellingPrice ?? product.price),
  lastMovementDate: getLastMovementDate(product),
  updatedAt: product.updatedAt,
});

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const validateMovementType = (type) => {
  const normalized = String(type || "").trim().toUpperCase();

  if (!STOCK_MOVEMENT_TYPES.includes(normalized)) {
    throw new ApiError(400, "Invalid movement type.", "VALIDATION_ERROR");
  }

  return normalized;
};

const validateMovementDirection = (movementType, quantityChange) => {
  if (movementType === "OPENING_STOCK" || movementType === "STOCK_IN") {
    if (quantityChange <= 0) {
      throw new ApiError(
        400,
        `${movementType} requires a positive quantity change.`,
        "VALIDATION_ERROR"
      );
    }
  }

  if (movementType === "STOCK_OUT" || movementType === "SALE_DEDUCTION") {
    if (quantityChange >= 0) {
      throw new ApiError(
        400,
        `${movementType} requires a negative quantity change.`,
        "VALIDATION_ERROR"
      );
    }
  }
};

const validateStockAction = (action) => {
  const normalized = String(action || "").trim().toLowerCase();

  if (!STOCK_ACTIONS.includes(normalized)) {
    throw new ApiError(400, "Invalid inventory action.", "VALIDATION_ERROR");
  }

  return normalized;
};

const normalizeReason = (value, { required = false, fallback = "" } = {}) => {
  const normalized = normalizeText(value, fallback);

  if (required && !normalized) {
    throw new ApiError(400, "Reason is required.", "VALIDATION_ERROR");
  }

  return normalized;
};

const normalizePerformedBy = (performedBy) => {
  const normalizedUserId =
    performedBy?.userId && mongoose.Types.ObjectId.isValid(performedBy.userId)
      ? new mongoose.Types.ObjectId(performedBy.userId)
      : null;

  return {
    userId: normalizedUserId,
    name: normalizeText(performedBy?.name),
    role: normalizeText(performedBy?.role),
  };
};

const normalizeQuantity = (value, { allowNegative = false, label = "Quantity" } = {}) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed === 0) {
    throw new ApiError(400, `${label} must be a non-zero number.`, "VALIDATION_ERROR");
  }

  if (!allowNegative && parsed < 0) {
    throw new ApiError(400, `${label} must be a positive number.`, "VALIDATION_ERROR");
  }

  return roundQuantity(parsed);
};

const normalizeTargetStock = (value, { allowNegative = false } = {}) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, "Target stock must be a valid number.", "VALIDATION_ERROR");
  }

  if (!allowNegative && parsed < 0) {
    throw new ApiError(400, "Target stock cannot be negative.", "VALIDATION_ERROR");
  }

  return roundQuantity(parsed);
};

const buildHistoryEntry = ({
  type,
  beforeQty,
  changeQty,
  afterQty,
  referenceType,
  referenceId,
  reason,
  note,
  performedBy,
  unitCost,
  unitPrice,
  movementDate,
}) => ({
  type,
  beforeQty,
  changeQty,
  afterQty,
  referenceType: String(referenceType || "SYSTEM").toUpperCase(),
  referenceId: String(referenceId || "").trim(),
  reason: normalizeReason(reason),
  note: String(note || "").trim(),
  performedByName: normalizeText(performedBy?.name),
  performedByRole: normalizeText(performedBy?.role),
  unitCost: roundNonNegative(unitCost),
  unitPrice: roundNonNegative(unitPrice),
  date: movementDate || new Date(),
});

const appendStockLog = async ({
  productId,
  type,
  beforeQty,
  changeQty,
  afterQty,
  referenceType,
  referenceId,
  reason,
  note,
  performedBy,
  unitCost,
  unitPrice,
  movementDate,
  metadata,
  session,
}) => {
  const historyEntry = buildHistoryEntry({
    type,
    beforeQty,
    changeQty,
    afterQty,
    referenceType,
    referenceId,
    reason,
    note,
    performedBy,
    unitCost,
    unitPrice,
    movementDate,
  });

  const normalizedPerformedBy = normalizePerformedBy(performedBy);

  await Promise.all([
    Product.updateOne(
      { _id: productId },
      {
        $push: {
          stockHistory: {
            $each: [historyEntry],
            $slice: -100,
          },
        },
      },
      { session }
    ),
    StockLedger.create(
      [
        {
          productId,
          type,
          beforeQty,
          changeQty,
          afterQty,
          referenceType: String(referenceType || "SYSTEM").toUpperCase(),
          referenceId: String(referenceId || "").trim(),
          reason: normalizeReason(reason),
          note: String(note || "").trim(),
          performedBy: normalizedPerformedBy,
          unitCost: roundNonNegative(unitCost),
          unitPrice: roundNonNegative(unitPrice),
          totalCost: roundCurrency(Math.abs(changeQty) * roundNonNegative(unitCost)),
          movementDate: movementDate || new Date(),
          metadata: metadata || {},
        },
      ],
      { session }
    ),
  ]);

  return historyEntry;
};

const recordMovement = async ({
  productId,
  movementType,
  quantityChange,
  referenceType = "SYSTEM",
  referenceId = "",
  reason = "",
  note = "",
  movementDate,
  metadata,
  performedBy,
  session,
  allowNegativeStock = false,
}) => {
  validateObjectId(productId, "product");
  const normalizedMovementType = validateMovementType(movementType);
  const normalizedQuantityChange = normalizeQuantity(quantityChange, {
    allowNegative: true,
    label: "Quantity change",
  });

  validateMovementDirection(normalizedMovementType, normalizedQuantityChange);

  const query = { _id: productId };
  if (!allowNegativeStock && normalizedQuantityChange < 0) {
    query.stock = { $gte: Math.abs(normalizedQuantityChange) };
  }

  const previousProduct = await Product.findOneAndUpdate(
    query,
    {
      $inc: { stock: normalizedQuantityChange },
    },
    {
      new: false,
      session,
    }
  );

  if (!previousProduct) {
    const product = await Product.findById(productId).select("name stock").session(session);

    if (!product) {
      throw new ApiError(404, "Product not found.", "NOT_FOUND");
    }

    const currentStock = roundQuantity(product.stock);
    const projectedStock = roundQuantity(currentStock + normalizedQuantityChange);

    if (!allowNegativeStock && projectedStock < 0) {
      throw new ApiError(
        400,
        `Stock movement would make ${product.name} negative. Available: ${currentStock}`,
        "INSUFFICIENT_STOCK"
      );
    }

    throw new ApiError(409, "Unable to apply stock movement. Please retry.", "STOCK_UPDATE_FAILED");
  }

  const beforeQty = roundQuantity(previousProduct.stock);
  const afterQty = roundQuantity(beforeQty + normalizedQuantityChange);
  const unitCost = roundNonNegative(previousProduct.costPrice);
  const unitPrice = roundNonNegative(previousProduct.sellingPrice ?? previousProduct.price);

  await appendStockLog({
    productId: previousProduct._id,
    type: normalizedMovementType,
    beforeQty,
    changeQty: normalizedQuantityChange,
    afterQty,
    referenceType,
    referenceId,
    reason,
    note,
    performedBy,
    unitCost,
    unitPrice,
    movementDate,
    metadata,
    session,
  });

  return {
    productId: previousProduct._id,
    movementType: normalizedMovementType,
    type: normalizedMovementType,
    beforeQty,
    changeQty: normalizedQuantityChange,
    afterQty,
    unitCost,
    unitPrice,
    totalCost: roundCurrency(Math.abs(normalizedQuantityChange) * unitCost),
  };
};

const recordSale = async ({
  productId,
  quantity,
  referenceType = "ORDER",
  referenceId = "",
  reason = "",
  note = "",
  movementDate,
  metadata,
  performedBy,
  session,
  allowNegativeStock = false,
}) => {
  const normalizedQuantity = normalizeQuantity(quantity, { label: "Sale quantity" });

  return recordMovement({
    productId,
    movementType: "SALE_DEDUCTION",
    quantityChange: roundQuantity(-normalizedQuantity),
    referenceType,
    referenceId,
    reason,
    note,
    movementDate,
    metadata,
    performedBy,
    session,
    allowNegativeStock,
  });
};

const recordAdjustment = async ({
  productId,
  quantity,
  movementType,
  referenceType = "MANUAL",
  referenceId = "",
  reason = "",
  note = "",
  movementDate,
  metadata,
  performedBy,
  session,
  allowNegativeStock = false,
}) => {
  const quantityChange = normalizeQuantity(quantity, {
    allowNegative: true,
    label: "Adjustment quantity",
  });

  const resolvedMovementType =
    movementType ||
    (quantityChange > 0 ? "STOCK_IN" : "STOCK_OUT");

  return recordMovement({
    productId,
    movementType: resolvedMovementType,
    quantityChange,
    referenceType,
    referenceId,
    reason,
    note,
    movementDate,
    metadata,
    performedBy,
    session,
    allowNegativeStock,
  });
};

const getCurrentStock = async ({ productId } = {}) => {
  if (productId) {
    validateObjectId(productId, "product");
  }

  const query = productId ? { _id: productId } : {};
  const products = await Product.find(query)
    .select("_id name sku category unitType stock reorderPoint status costPrice sellingPrice price updatedAt stockHistory.date")
    .sort({ name: 1 });

  return products.map((product) => formatStockRow(product));
};

const getLowStock = async () => {
  const products = await Product.find({})
    .select("_id name sku category unitType stock reorderPoint status costPrice sellingPrice price updatedAt stockHistory.date")
    .sort({ stock: 1, name: 1 });

  return products
    .map((product) => formatStockRow(product))
    .filter((product) => product.stock <= product.lowStockThreshold);
};

const adjustStock = async ({
  productId,
  action,
  quantity,
  targetStock,
  reason = "",
  note = "",
  referenceId = "",
  performedBy,
  allowNegativeStock = false,
} = {}) => {
  validateObjectId(productId, "product");
  const normalizedAction = validateStockAction(action);
  const resolvedReason = normalizeReason(reason, { required: true });
  const product = await Product.findById(productId).select(
    "_id name sku category unitType stock reorderPoint status costPrice sellingPrice price updatedAt stockHistory.date"
  );

  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }

  const currentStock = roundQuantity(product.stock);
  let changeQty = 0;
  let resolvedNote = String(note || "").trim();
  let movementType = STOCK_ACTION_MOVEMENT_MAP[normalizedAction];
  let resolvedTargetStock;

  if (normalizedAction === "adjust") {
    resolvedTargetStock = normalizeTargetStock(targetStock, { allowNegative: allowNegativeStock });
    changeQty = roundQuantity(resolvedTargetStock - currentStock);

    if (changeQty === 0) {
      throw new ApiError(
        400,
        "Adjusted stock matches the current stock. No change was made.",
        "VALIDATION_ERROR"
      );
    }

    if (!resolvedNote) {
      resolvedNote = `Stock adjusted from ${currentStock} to ${resolvedTargetStock}`;
    }
  } else {
    const normalizedQuantity = normalizeQuantity(quantity);
    changeQty = normalizedAction === "reduce" ? roundQuantity(-normalizedQuantity) : normalizedQuantity;

    if (!resolvedNote) {
      resolvedNote =
        normalizedAction === "add"
          ? `Stock received: ${normalizedQuantity}`
          : `Stock issued: ${normalizedQuantity}`;
    }
  }

  await recordAdjustment({
    productId,
    quantity: changeQty,
    movementType,
    referenceType: "MANUAL",
    referenceId: String(referenceId || "").trim(),
    reason: resolvedReason,
    note: resolvedNote,
    metadata: {
      action: normalizedAction,
      targetStock: normalizedAction === "adjust" ? resolvedTargetStock : undefined,
    },
    performedBy,
    allowNegativeStock,
  });

  const updatedProduct = await Product.findById(productId).select(
    "_id name sku category unitType stock reorderPoint status costPrice sellingPrice price updatedAt stockHistory.date"
  );

  return formatStockRow(updatedProduct);
};

const getStockHistory = async ({
  productId,
  movementType,
  fromDate,
  toDate,
  page = 1,
  limit = 50,
} = {}) => {
  if (productId) {
    validateObjectId(productId, "product");
  }

  const normalizedPage = Math.max(1, toNumber(page, 1));
  const normalizedLimit = Math.min(200, Math.max(1, toNumber(limit, 50)));
  const skip = (normalizedPage - 1) * normalizedLimit;
  const query = {};

  if (productId) {
    query.productId = productId;
  }

  if (movementType) {
    query.type = validateMovementType(movementType);
  }

  if (fromDate || toDate) {
    query.movementDate = {};
    let parsedFrom = null;
    let parsedTo = null;

    if (fromDate) {
      parsedFrom = new Date(fromDate);

      if (Number.isNaN(parsedFrom.getTime())) {
        throw new ApiError(400, "Invalid fromDate value.", "VALIDATION_ERROR");
      }

      parsedFrom.setUTCHours(0, 0, 0, 0);
      query.movementDate.$gte = parsedFrom;
    }

    if (toDate) {
      parsedTo = new Date(toDate);

      if (Number.isNaN(parsedTo.getTime())) {
        throw new ApiError(400, "Invalid toDate value.", "VALIDATION_ERROR");
      }

      parsedTo.setUTCHours(23, 59, 59, 999);
      query.movementDate.$lte = parsedTo;
    }

    if (parsedFrom && parsedTo && parsedFrom > parsedTo) {
      throw new ApiError(400, "From date cannot be later than to date.", "VALIDATION_ERROR");
    }
  }

  const [items, total] = await Promise.all([
    StockLedger.find(query)
      .populate("productId", "name sku category")
      .sort({ movementDate: -1, _id: -1 })
      .skip(skip)
      .limit(normalizedLimit),
    StockLedger.countDocuments(query),
  ]);

  return {
    items: items.map((entry) => ({
      id: entry._id,
      productId: entry.productId?._id || entry.productId,
      productName: entry.productId?.name || "Unknown Product",
      sku: entry.productId?.sku || "",
      category: entry.productId?.category || "",
      movementType: entry.type,
      type: entry.type,
      previousStock: roundQuantity(entry.beforeQty),
      beforeQty: roundQuantity(entry.beforeQty),
      quantityChange: roundQuantity(entry.changeQty),
      changeQty: roundQuantity(entry.changeQty),
      newStock: roundQuantity(entry.afterQty),
      afterQty: roundQuantity(entry.afterQty),
      referenceType: entry.referenceType || "",
      referenceId: entry.referenceId || "",
      reason: entry.reason || "",
      note: entry.note || "",
      performedBy: entry.performedBy || {},
      userName: entry.performedBy?.name || "",
      userRole: entry.performedBy?.role || "",
      unitCost: roundNonNegative(entry.unitCost),
      unitPrice: roundNonNegative(entry.unitPrice),
      totalCost: roundCurrency(toNumber(entry.totalCost, 0)),
      movementDate: entry.movementDate,
      createdAt: entry.createdAt,
      metadata: entry.metadata || {},
    })),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit) || 1,
    },
  };
};

module.exports = {
  STOCK_MOVEMENT_TYPES,
  getCurrentStock,
  getLowStock,
  getStockHistory,
  recordMovement,
  recordSale,
  recordAdjustment,
  adjustStock,
};
