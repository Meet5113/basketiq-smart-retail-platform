const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const StockLedger = require("../models/StockLedger");
const ApiError = require("../utils/ApiError");
const { GST_SLABS, normalizeTaxRate, roundCurrency } = require("./gstService");
const { runInTransaction } = require("./transactionService");

const ALLOWED_GST_RATES = [0, ...GST_SLABS];
const PRODUCT_STATUS_OPTIONS = ["active", "inactive"];
const TAX_TYPE_OPTIONS = ["exclusive", "inclusive", "exempt"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundNonNegative = (value) => roundCurrency(Math.max(0, toNumber(value, 0)));
const roundStockQuantity = (value) => roundCurrency(toNumber(value, 0));
const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const getSessionOptions = (session) => (session ? { session } : {});
const applySession = (query, session) => (session ? query.session(session) : query);

const isMissingValue = (value) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

const normalizeRequiredText = (value, label, { uppercase = false } = {}) => {
  if (typeof value !== "string") {
    throw new ApiError(400, `${label} must be a string.`, "VALIDATION_ERROR");
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new ApiError(400, `${label} is required.`, "VALIDATION_ERROR");
  }

  return uppercase ? normalized.toUpperCase() : normalized;
};

const normalizeOptionalText = (value, label, { uppercase = false } = {}) => {
  if (isMissingValue(value)) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, `${label} must be a string.`, "VALIDATION_ERROR");
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return uppercase ? normalized.toUpperCase() : normalized;
};

const normalizeOptionalArray = (value, label) => {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ApiError(400, `${label} must be an array.`, "VALIDATION_ERROR");
  }

  return value;
};

const normalizeEnumValue = (value, label, options, fallback) => {
  if (isMissingValue(value)) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, `${label} must be a string.`, "VALIDATION_ERROR");
  }

  const normalized = value.trim().toLowerCase();
  if (!options.includes(normalized)) {
    throw new ApiError(
      400,
      `${label} must be one of: ${options.join(", ")}.`,
      "VALIDATION_ERROR"
    );
  }

  return normalized;
};

const parseNonNegativeNumber = (value, label, { fallback = 0 } = {}) => {
  if (isMissingValue(value)) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, `${label} must be a valid number.`, "VALIDATION_ERROR");
  }

  if (parsed < 0) {
    throw new ApiError(400, `${label} cannot be negative.`, "VALIDATION_ERROR");
  }

  return roundCurrency(parsed);
};

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const normalizePairs = (rows) =>
  normalizeOptionalArray(rows, "Display attributes")
    .map((row, index) => {
      if (!isPlainObject(row)) {
        throw new ApiError(
          400,
          `Display attribute ${index + 1} must be an object with key and value fields.`,
          "VALIDATION_ERROR"
        );
      }

      return {
        key: normalizeOptionalText(row.key, `Display attribute ${index + 1} key`) || "",
        value: normalizeOptionalText(row.value, `Display attribute ${index + 1} value`) || "",
      };
    })
    .filter((row) => row.key || row.value);

const normalizeImages = (rows, primaryImage) => {
  const normalizedRows = normalizeOptionalArray(rows, "Images");
  const primaryImageUrl = normalizeOptionalText(primaryImage, "Primary image");

  const images = normalizedRows.reduce((result, row, index) => {
    if (typeof row === "string") {
      const url = normalizeOptionalText(row, `Image ${index + 1} URL`);
      if (url) {
        result.push({ url, isPrimary: false });
      }
      return result;
    }

    if (!isPlainObject(row)) {
      throw new ApiError(
        400,
        `Image ${index + 1} must be an object with url and isPrimary fields.`,
        "VALIDATION_ERROR"
      );
    }

    const url = normalizeOptionalText(row.url, `Image ${index + 1} URL`);
    if (!url) {
      return result;
    }

    if (row.isPrimary !== undefined && typeof row.isPrimary !== "boolean") {
      throw new ApiError(
        400,
        `Image ${index + 1} primary flag must be true or false.`,
        "VALIDATION_ERROR"
      );
    }

    result.push({
      url,
      isPrimary: Boolean(row.isPrimary),
    });
    return result;
  }, []);

  if (primaryImageUrl && !images.some((image) => image.url === primaryImageUrl)) {
    images.unshift({ url: primaryImageUrl, isPrimary: true });
  }

  if (images.length === 0) {
    return {
      images: [],
      primaryImage: primaryImageUrl,
    };
  }

  const resolvedPrimaryUrl =
    primaryImageUrl ||
    images.find((image) => image.isPrimary)?.url ||
    images[0]?.url ||
    null;

  return {
    images: images.map((image) => ({
      ...image,
      isPrimary: image.url === resolvedPrimaryUrl,
    })),
    primaryImage: resolvedPrimaryUrl,
  };
};

const sanitizeProductPayload = (payload = {}) => {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "Product payload must be a JSON object.", "VALIDATION_ERROR");
  }

  const { images, primaryImage } = normalizeImages(payload.images, payload.primaryImage);
  const costPrice = parseNonNegativeNumber(payload.costPrice, "Cost price");
  const sellingPrice = parseNonNegativeNumber(
    payload.sellingPrice ?? payload.price,
    "Selling price"
  );
  const safeTaxType = normalizeEnumValue(
    payload.taxType,
    "Tax type",
    TAX_TYPE_OPTIONS,
    "exclusive"
  );
  const rawGstRate = isMissingValue(payload.gstRate) ? 0 : Number(payload.gstRate);

  if (!Number.isFinite(rawGstRate)) {
    throw new ApiError(400, "GST rate must be a valid number.", "VALIDATION_ERROR");
  }

  if (!ALLOWED_GST_RATES.includes(rawGstRate)) {
    throw new ApiError(
      400,
      `GST rate must be one of: ${ALLOWED_GST_RATES.join(", ")}.`,
      "VALIDATION_ERROR"
    );
  }

  return {
    name: normalizeRequiredText(payload.name, "Product name"),
    sku: normalizeRequiredText(payload.sku, "SKU", { uppercase: true }),
    category: normalizeOptionalText(payload.category, "Category"),
    brand: normalizeOptionalText(payload.brand, "Brand"),
    unitType: normalizeOptionalText(payload.unitType, "Unit type") || "unit",
    status: normalizeEnumValue(payload.status, "Status", PRODUCT_STATUS_OPTIONS, "active"),
    shortDescription: normalizeOptionalText(payload.shortDescription, "Short description"),
    description: normalizeOptionalText(
      payload.fullDescription ?? payload.description,
      "Description"
    ),
    attributes: normalizePairs(payload.attributes),
    specifications: normalizePairs(payload.specifications),
    costPrice,
    sellingPrice,
    price: sellingPrice,
    gstRate:
      safeTaxType === "exempt"
        ? 0
        : normalizeTaxRate(rawGstRate, {
            allowZero: true,
            fallback: 0,
          }),
    taxType: safeTaxType,
    hsnSacCode: normalizeOptionalText(payload.hsnSacCode ?? payload.hsnCode, "HSN/SAC code", {
      uppercase: true,
    }),
    hsnCode: normalizeOptionalText(payload.hsnCode ?? payload.hsnSacCode, "HSN/SAC code", {
      uppercase: true,
    }),
    minStock: parseNonNegativeNumber(payload.minStock, "Minimum stock"),
    maxStock: parseNonNegativeNumber(payload.maxStock, "Maximum stock"),
    reorderPoint: parseNonNegativeNumber(payload.reorderPoint, "Reorder point"),
    barcode: normalizeOptionalText(payload.barcode, "Barcode"),
    images,
    primaryImage,
  };
};

const ensureProductPayload = (payload, { requireSku = true } = {}) => {
  if (!payload.name) {
    throw new ApiError(400, "Product name is required.", "VALIDATION_ERROR");
  }

  if (requireSku && !payload.sku) {
    throw new ApiError(400, "SKU is required.", "VALIDATION_ERROR");
  }

  if (payload.maxStock > 0 && payload.minStock > payload.maxStock) {
    throw new ApiError(
      400,
      "Minimum stock cannot be greater than maximum stock.",
      "VALIDATION_ERROR"
    );
  }

  if (payload.maxStock > 0 && payload.reorderPoint > payload.maxStock) {
    throw new ApiError(
      400,
      "Reorder point cannot be greater than maximum stock.",
      "VALIDATION_ERROR"
    );
  }
};

const normalizeProductStatus = (value, fallback = "active") => {
  const normalized = String(value || fallback).trim().toLowerCase();
  return normalized === "inactive" ? "inactive" : "active";
};

const getProductMetricsMap = async (productIds) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return new Map();
  }

  const metrics = await Order.aggregate([
    {
      $match: {
        $or: [{ status: "completed" }, { status: { $exists: false } }],
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.productId": {
          $in: productIds.map((id) => new mongoose.Types.ObjectId(id)),
        },
      },
    },
    {
      $group: {
        _id: "$items.productId",
        totalSoldUnits: { $sum: { $ifNull: ["$items.quantity", 0] } },
        revenueGenerated: {
          $sum: {
            $ifNull: [
              "$items.finalLineTotal",
              {
                $multiply: [
                  { $ifNull: ["$items.price", 0] },
                  { $ifNull: ["$items.quantity", 0] },
                ],
              },
            ],
          },
        },
        profitGenerated: { $sum: { $ifNull: ["$items.profitAmount", 0] } },
      },
    },
  ]);

  return new Map(
    metrics.map((metric) => [
      String(metric._id),
      {
        totalSoldUnits: toNumber(metric.totalSoldUnits, 0),
        revenueGenerated: roundNonNegative(metric.revenueGenerated),
        profitGenerated: roundCurrency(toNumber(metric.profitGenerated, 0)),
      },
    ])
  );
};

const formatInventoryInsights = (product, metrics = {}) => {
  const stock = roundStockQuantity(product.stock);
  const costPrice = roundNonNegative(product.costPrice);
  const sellingPrice = roundNonNegative(product.sellingPrice ?? product.price);
  const unitProfit = roundCurrency(sellingPrice - costPrice);
  const threshold = roundNonNegative(product.reorderPoint) > 0 ? roundNonNegative(product.reorderPoint) : 10;

  return {
    inventoryValue: roundCurrency(stock * costPrice),
    potentialProfit: roundCurrency(stock * unitProfit),
    minStock: roundNonNegative(product.minStock),
    maxStock: roundNonNegative(product.maxStock),
    reorderPoint: roundNonNegative(product.reorderPoint),
    lowStockAlert: stock <= threshold,
    totalSoldUnits: toNumber(metrics.totalSoldUnits, 0),
    revenueGenerated: roundNonNegative(metrics.revenueGenerated),
    profitGenerated: roundCurrency(toNumber(metrics.profitGenerated, 0)),
    stockTurnoverRate:
      toNumber(metrics.totalSoldUnits, 0) <= 0
        ? 0
        : roundCurrency(
            toNumber(metrics.totalSoldUnits, 0) /
              Math.max((stock + toNumber(metrics.totalSoldUnits, 0)) / 2, 1)
          ),
  };
};

const formatInventoryLogs = (product) =>
  (Array.isArray(product.stockHistory) ? product.stockHistory : [])
    .filter((entry) => toNumber(entry.changeQty, 0) !== 0 || toNumber(entry.beforeQty, 0) !== toNumber(entry.afterQty, 0))
    .map((entry) => ({
      type: entry.type,
      beforeQty: roundStockQuantity(entry.beforeQty),
      changeQty: roundCurrency(toNumber(entry.changeQty, 0)),
      afterQty: roundStockQuantity(entry.afterQty),
      referenceType: entry.referenceType || "",
      referenceId: entry.referenceId || "",
      reason: entry.reason || "",
      note: entry.note || "",
      performedByName: entry.performedByName || "",
      performedByRole: entry.performedByRole || "",
      unitCost: roundNonNegative(entry.unitCost),
      unitPrice: roundNonNegative(entry.unitPrice),
      date: entry.date,
    }))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

const formatProduct = (product, metrics = {}) => {
  const productObject = typeof product.toObject === "function" ? product.toObject() : product;
  const stock = roundStockQuantity(productObject.stock);
  const sellingPrice = roundNonNegative(productObject.sellingPrice ?? productObject.price);
  const costPrice = roundNonNegative(productObject.costPrice);
  const insights = formatInventoryInsights(productObject, metrics);

  return {
    ...productObject,
    stock,
    sellingPrice,
    price: sellingPrice,
    costPrice,
    hsnCode: productObject.hsnCode || productObject.hsnSacCode || "",
    hsnSacCode: productObject.hsnCode || productObject.hsnSacCode || "",
    inventoryInsights: insights,
    inventoryLogs: formatInventoryLogs(productObject),
    totalSoldUnits: insights.totalSoldUnits,
    revenueGenerated: insights.revenueGenerated,
    profitGenerated: insights.profitGenerated,
    stockTurnoverRate: insights.stockTurnoverRate,
  };
};

const createProduct = async (payload = {}) => {
  const normalizedPayload = sanitizeProductPayload(payload);
  ensureProductPayload(normalizedPayload);

  let createdProduct = null;

  await runInTransaction(async (session) => {
    const [product] = await Product.create(
      [
        {
          ...normalizedPayload,
          stock: 0,
          stockHistory: [],
        },
      ],
      getSessionOptions(session)
    );

    createdProduct = await applySession(Product.findById(product._id), session);
  });

  return formatProduct(createdProduct);
};

const getProducts = async ({ search, category, status } = {}) => {
  const query = {};

  if (search) {
    const regex = new RegExp(String(search).trim(), "i");
    query.$or = [{ name: regex }, { sku: regex }, { category: regex }];
  }

  if (category) {
    query.category = new RegExp(`^${String(category).trim()}$`, "i");
  }

  if (status) {
    query.status = String(status).trim().toLowerCase();
  }

  const products = await Product.find(query).sort({ createdAt: -1, name: 1 });
  const metricsMap = await getProductMetricsMap(products.map((product) => String(product._id)));

  return products.map((product) => formatProduct(product, metricsMap.get(String(product._id))));
};

const getProductById = async (id) => {
  validateObjectId(id, "product");
  const product = await Product.findById(id);

  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }

  const metricsMap = await getProductMetricsMap([String(product._id)]);
  return formatProduct(product, metricsMap.get(String(product._id)));
};

const updateProduct = async (id, payload = {}) => {
  validateObjectId(id, "product");

  let updatedProduct = null;

  await runInTransaction(async (session) => {
    const existingProduct = await applySession(Product.findById(id), session);

    if (!existingProduct) {
      throw new ApiError(404, "Product not found.", "NOT_FOUND");
    }

    const mergedPayload = {
      ...existingProduct.toObject(),
      ...payload,
      description:
        payload.fullDescription ??
        payload.description ??
        existingProduct.description,
      fullDescription:
        payload.fullDescription ??
        payload.description ??
        existingProduct.description,
      attributes: payload.attributes ?? existingProduct.attributes,
      specifications: payload.specifications ?? existingProduct.specifications,
      images: payload.images ?? existingProduct.images,
      primaryImage: payload.primaryImage ?? existingProduct.primaryImage,
      stock: existingProduct.stock,
      minStock: existingProduct.minStock,
      maxStock: existingProduct.maxStock,
      reorderPoint: existingProduct.reorderPoint,
    };

    const normalizedPayload = sanitizeProductPayload(mergedPayload);
    ensureProductPayload(normalizedPayload);

    existingProduct.name = normalizedPayload.name;
    existingProduct.sku = normalizedPayload.sku;
    existingProduct.category = normalizedPayload.category;
    existingProduct.brand = normalizedPayload.brand;
    existingProduct.unitType = normalizedPayload.unitType;
    existingProduct.status = normalizedPayload.status;
    existingProduct.shortDescription = normalizedPayload.shortDescription;
    existingProduct.description = normalizedPayload.description;
    existingProduct.attributes = normalizedPayload.attributes;
    existingProduct.specifications = normalizedPayload.specifications;
    existingProduct.costPrice = normalizedPayload.costPrice;
    existingProduct.sellingPrice = normalizedPayload.sellingPrice;
    existingProduct.price = normalizedPayload.price;
    existingProduct.gstRate = normalizedPayload.gstRate;
    existingProduct.taxType = normalizedPayload.taxType;
    existingProduct.hsnCode = normalizedPayload.hsnCode;
    existingProduct.hsnSacCode = normalizedPayload.hsnSacCode;
    existingProduct.minStock = normalizedPayload.minStock;
    existingProduct.maxStock = normalizedPayload.maxStock;
    existingProduct.reorderPoint = normalizedPayload.reorderPoint;
    existingProduct.barcode = normalizedPayload.barcode;
    existingProduct.images = normalizedPayload.images;
    existingProduct.primaryImage = normalizedPayload.primaryImage;
    await existingProduct.save(getSessionOptions(session));

    updatedProduct = await applySession(Product.findById(existingProduct._id), session);
  });

  const metricsMap = await getProductMetricsMap([String(updatedProduct._id)]);
  return formatProduct(updatedProduct, metricsMap.get(String(updatedProduct._id)));
};

const updateProductStatus = async (id, status) => {
  validateObjectId(id, "product");
  const normalizedStatus = normalizeProductStatus(status);

  const product = await Product.findById(id);

  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }

  product.status = normalizedStatus;
  await product.save();

  const metricsMap = await getProductMetricsMap([String(product._id)]);
  return formatProduct(product, metricsMap.get(String(product._id)));
};

const deleteProduct = async (id) => {
  validateObjectId(id, "product");
  const deleted = await Product.findByIdAndDelete(id);

  if (!deleted) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }

  await stockCleanup(id);
};

const stockCleanup = async (productId) => {
  await StockLedger.deleteMany({ productId });
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};
