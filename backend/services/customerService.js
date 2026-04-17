const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_CODE_REGEX = /^[0-9]{2}$/;
const PHONE_REGEX = /^(?:\+?91)?[6-9]\d{9}$/;
const CUSTOMER_TYPE_OPTIONS = ["walk_in", "regular", "business"];
const SORT_OPTIONS = ["recent", "highest_spend", "most_orders"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundCurrency = (value) => Number(toNumber(value, 0).toFixed(2));

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const normalizeRequiredText = (value, label) => {
  if (typeof value !== "string") {
    throw new ApiError(400, `${label} must be a string.`, "VALIDATION_ERROR");
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new ApiError(400, `${label} is required.`, "VALIDATION_ERROR");
  }

  return normalized;
};

const normalizeOptionalText = (value, label) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    throw new ApiError(400, `${label} must be a string.`, "VALIDATION_ERROR");
  }

  return value.trim();
};

const normalizeGstin = (value) => String(value || "").trim().toUpperCase();

const normalizeStateCode = (value) => {
  const digits = String(value || "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 2);

  return STATE_CODE_REGEX.test(digits) ? digits : "";
};

const normalizePhone = (value) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  const normalizedDigits =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(-10) : digits;

  if (!PHONE_REGEX.test(raw) && !PHONE_REGEX.test(normalizedDigits)) {
    throw new ApiError(
      400,
      "Phone number must be a valid 10-digit Indian mobile number.",
      "VALIDATION_ERROR"
    );
  }

  return normalizedDigits;
};

const extractSearchDigits = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .trim();

const inferCustomerType = (customerType, gstin) => {
  const normalizedType = String(customerType || "").trim().toLowerCase();

  if (gstin) {
    return "business";
  }

  if (!normalizedType) {
    return "regular";
  }

  if (!CUSTOMER_TYPE_OPTIONS.includes(normalizedType)) {
    throw new ApiError(
      400,
      `Customer type must be one of: ${CUSTOMER_TYPE_OPTIONS.join(", ")}.`,
      "VALIDATION_ERROR"
    );
  }

  return normalizedType;
};

const deriveCityFromAddress = (address) => {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return "";
};

const formatOrderSnapshot = (order) => ({
  _id: order._id,
  invoiceNumber: order.invoiceNumber || "",
  finalAmount: roundCurrency(order.finalAmount ?? order.totalAmount),
  status: String(order.status || "completed").toLowerCase(),
  paymentMethod: String(order.paymentMethod || "cash").toLowerCase(),
  createdAt: order.createdAt,
  itemCount: Array.isArray(order.items) ? order.items.length : 0,
});

const formatCustomer = (customer) => {
  const customerObject =
    typeof customer?.toObject === "function" ? customer.toObject() : customer || {};
  const orderCount = Math.max(0, toNumber(customerObject?.stats?.orderCount, 0));
  const totalSpend = roundCurrency(customerObject?.stats?.totalSpend);
  const averageOrderValue = roundCurrency(customerObject?.stats?.averageOrderValue);
  const lastPurchaseDate = customerObject?.stats?.lastPurchaseDate || null;
  const gstin = normalizeGstin(customerObject.gstin);
  const stateCode = normalizeStateCode(customerObject.stateCode);
  const address = String(customerObject.address || "").trim();
  const city = deriveCityFromAddress(address);

  return {
    ...customerObject,
    gstin,
    stateCode,
    customerType: inferCustomerType(customerObject.customerType, gstin),
    isActive: customerObject.isActive !== false,
    notes: String(customerObject.notes || "").trim(),
    stats: {
      orderCount,
      totalSpend,
      lastPurchaseDate,
      averageOrderValue,
    },
    orderCount,
    totalSpend,
    lastPurchaseDate,
    averageOrderValue,
    isRepeatCustomer: orderCount > 1,
    gstStatus: gstin ? "gst" : "non_gst",
    city,
    cityStateLabel: [city || "N/A", stateCode ? `State ${stateCode}` : "N/A"].join(" / "),
  };
};

const ensureUniqueCustomerIdentity = async ({
  phone,
  gstin,
  excludeCustomerId = null,
}) => {
  const normalizedExcludeId = excludeCustomerId ? String(excludeCustomerId) : "";

  const phoneOwner = await Customer.findOne(
    normalizedExcludeId
      ? { phone, _id: { $ne: normalizedExcludeId } }
      : { phone }
  ).select("name phone");

  if (phoneOwner) {
    throw new ApiError(
      409,
      `A customer with phone number ${phone} already exists as ${phoneOwner.name}.`,
      "CUSTOMER_PHONE_EXISTS"
    );
  }

  if (gstin) {
    const gstOwner = await Customer.findOne(
      normalizedExcludeId
        ? { gstin, _id: { $ne: normalizedExcludeId } }
        : { gstin }
    ).select("name gstin");

    if (gstOwner) {
      throw new ApiError(
        409,
        `A customer with GSTIN ${gstin} already exists as ${gstOwner.name}.`,
        "CUSTOMER_GSTIN_EXISTS"
      );
    }
  }
};

const normalizeCustomerPayload = (payload = {}, existingCustomer = null) => {
  const normalizedName = normalizeRequiredText(
    payload.name ?? existingCustomer?.name,
    "Customer name"
  );
  const normalizedPhone = normalizePhone(payload.phone ?? existingCustomer?.phone);
  const normalizedEmail = normalizeOptionalText(
    payload.email ?? existingCustomer?.email,
    "Customer email"
  ).toLowerCase();
  const normalizedAddress = normalizeOptionalText(
    payload.address ?? existingCustomer?.address,
    "Customer address"
  );
  const normalizedGstin = normalizeGstin(payload.gstin ?? existingCustomer?.gstin);
  const inferredStateCode = normalizedGstin ? normalizedGstin.slice(0, 2) : "";
  const rawStateCode =
    payload.stateCode !== undefined
      ? payload.stateCode
      : existingCustomer?.stateCode || inferredStateCode;
  const normalizedStateCode = normalizeStateCode(rawStateCode || inferredStateCode);
  const customerType = inferCustomerType(
    payload.customerType ?? existingCustomer?.customerType,
    normalizedGstin
  );
  const notes = normalizeOptionalText(payload.notes ?? existingCustomer?.notes, "Customer notes");
  const isActive =
    payload.isActive === undefined
      ? existingCustomer?.isActive !== false
      : Boolean(payload.isActive);

  if (normalizedEmail && !EMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, "Please provide a valid customer email.", "VALIDATION_ERROR");
  }

  if (normalizedGstin && !GSTIN_REGEX.test(normalizedGstin)) {
    throw new ApiError(400, "Please provide a valid customer GSTIN.", "VALIDATION_ERROR");
  }

  if ((payload.stateCode || normalizedStateCode) && !normalizedStateCode) {
    throw new ApiError(
      400,
      "Customer state code must be a valid two-digit GST state code.",
      "VALIDATION_ERROR"
    );
  }

  if (customerType === "walk_in" && normalizedGstin) {
    throw new ApiError(
      400,
      "Walk-in customers cannot carry GSTIN. Use Business / GST customer type instead.",
      "VALIDATION_ERROR"
    );
  }

  return {
    name: normalizedName,
    phone: normalizedPhone,
    email: normalizedEmail,
    address: normalizedAddress,
    gstin: normalizedGstin,
    stateCode: normalizedStateCode,
    customerType,
    notes,
    isActive,
  };
};

const refreshCustomerStats = async (customerId, { session = null } = {}) => {
  if (!customerId) {
    return null;
  }

  const normalizedCustomerId = String(customerId);
  validateObjectId(normalizedCustomerId, "customer");
  const objectId = new mongoose.Types.ObjectId(normalizedCustomerId);

  const statsResult = await Order.aggregate([
    {
      $match: {
        customerId: objectId,
        $or: [{ status: "completed" }, { status: { $exists: false } }],
      },
    },
    {
      $group: {
        _id: "$customerId",
        orderCount: { $sum: 1 },
        totalSpend: { $sum: { $ifNull: ["$finalAmount", "$totalAmount"] } },
        lastPurchaseDate: { $max: "$createdAt" },
      },
    },
  ]).session(session);

  const metrics = statsResult[0] || {
    orderCount: 0,
    totalSpend: 0,
    lastPurchaseDate: null,
  };

  const orderCount = Math.max(0, toNumber(metrics.orderCount, 0));
  const totalSpend = roundCurrency(metrics.totalSpend);
  const averageOrderValue = orderCount > 0 ? roundCurrency(totalSpend / orderCount) : 0;

  const updatedCustomer = await Customer.findByIdAndUpdate(
    normalizedCustomerId,
    {
      $set: {
        "stats.orderCount": orderCount,
        "stats.totalSpend": totalSpend,
        "stats.lastPurchaseDate": metrics.lastPurchaseDate || null,
        "stats.averageOrderValue": averageOrderValue,
      },
    },
    {
      new: true,
      session,
    }
  );

  return updatedCustomer ? formatCustomer(updatedCustomer) : null;
};

const createCustomer = async (payload = {}) => {
  const normalizedPayload = normalizeCustomerPayload(payload);
  await ensureUniqueCustomerIdentity({
    phone: normalizedPayload.phone,
    gstin: normalizedPayload.gstin,
  });
  const customer = await Customer.create(normalizedPayload);
  return formatCustomer(customer);
};

const getCustomers = async ({
  search,
  customerType,
  gstStatus,
  status,
  sort = "recent",
} = {}) => {
  const query = {};
  const normalizedSearch = String(search || "").trim();
  const normalizedCustomerType = String(customerType || "").trim().toLowerCase();
  const normalizedGstStatus = String(gstStatus || "").trim().toLowerCase();
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const normalizedSort = SORT_OPTIONS.includes(String(sort || "").trim().toLowerCase())
    ? String(sort || "").trim().toLowerCase()
    : "recent";

  if (normalizedSearch) {
    const regex = new RegExp(normalizedSearch, "i");
    const searchDigits = extractSearchDigits(normalizedSearch);

    query.$or = [{ name: regex }, { email: regex }];

    if (searchDigits) {
      query.$or.push({ phone: new RegExp(searchDigits, "i") });
    } else {
      query.$or.push({ phone: regex });
    }
  }

  if (normalizedCustomerType) {
    if (!CUSTOMER_TYPE_OPTIONS.includes(normalizedCustomerType)) {
      throw new ApiError(
        400,
        `Customer type must be one of: ${CUSTOMER_TYPE_OPTIONS.join(", ")}.`,
        "VALIDATION_ERROR"
      );
    }

    query.customerType = normalizedCustomerType;
  }

  if (normalizedGstStatus === "gst") {
    query.gstin = { $exists: true, $type: "string", $gt: "" };
  } else if (normalizedGstStatus === "non_gst") {
    query.$and = [...(query.$and || []), { $or: [{ gstin: "" }, { gstin: { $exists: false } }] }];
  } else if (normalizedGstStatus) {
    throw new ApiError(400, "GST status must be gst or non_gst.", "VALIDATION_ERROR");
  }

  if (normalizedStatus === "active") {
    query.isActive = true;
  } else if (normalizedStatus === "inactive") {
    query.isActive = false;
  } else if (normalizedStatus) {
    throw new ApiError(
      400,
      "Customer status must be active or inactive.",
      "VALIDATION_ERROR"
    );
  }

  const sortMap = {
    recent: { createdAt: -1, name: 1 },
    highest_spend: { "stats.totalSpend": -1, "stats.orderCount": -1, createdAt: -1 },
    most_orders: { "stats.orderCount": -1, "stats.totalSpend": -1, createdAt: -1 },
  };

  const customers = await Customer.find(query).sort(sortMap[normalizedSort]);
  return customers.map((customer) => formatCustomer(customer));
};

const getCustomerById = async (id) => {
  validateObjectId(id, "customer");
  const customer = await Customer.findById(id);

  if (!customer) {
    throw new ApiError(404, "Customer not found.", "NOT_FOUND");
  }

  const recentOrders = await Order.find({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .limit(8)
    .select(
      "_id invoiceNumber finalAmount totalAmount status paymentMethod createdAt items customerName"
    );

  return {
    ...formatCustomer(customer),
    recentOrders: recentOrders.map((order) => formatOrderSnapshot(order)),
  };
};

const updateCustomer = async (id, payload = {}) => {
  validateObjectId(id, "customer");
  const customer = await Customer.findById(id);

  if (!customer) {
    throw new ApiError(404, "Customer not found.", "NOT_FOUND");
  }

  const normalizedPayload = normalizeCustomerPayload(payload, customer);
  await ensureUniqueCustomerIdentity({
    phone: normalizedPayload.phone,
    gstin: normalizedPayload.gstin,
    excludeCustomerId: customer._id,
  });
  Object.assign(customer, normalizedPayload);
  await customer.save();

  return formatCustomer(customer);
};

const updateCustomerStatus = async (id, isActive) => {
  validateObjectId(id, "customer");
  const customer = await Customer.findById(id);

  if (!customer) {
    throw new ApiError(404, "Customer not found.", "NOT_FOUND");
  }

  customer.isActive = Boolean(isActive);
  await customer.save();

  return formatCustomer(customer);
};

const deleteCustomer = async (id) => {
  validateObjectId(id, "customer");
  const customer = await Customer.findById(id);

  if (!customer) {
    throw new ApiError(404, "Customer not found.", "NOT_FOUND");
  }

  const linkedOrder = await Order.findOne({ customerId: customer._id }).select("_id");
  if (linkedOrder) {
    throw new ApiError(
      409,
      "Customers with billing history cannot be deleted. Mark the customer inactive instead.",
      "CUSTOMER_HAS_ORDERS"
    );
  }

  await customer.deleteOne();
  return null;
};

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  deleteCustomer,
  refreshCustomerStats,
};
