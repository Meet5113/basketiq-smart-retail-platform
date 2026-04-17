const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const SystemSettings = require("../models/SystemSettings");
const ApiError = require("../utils/ApiError");
const { getInsufficientStockMode } = require("../utils/stockPolicy");

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PHONE_REGEX = /^[+()\-\s0-9]{7,20}$/;
const DEFAULT_GST_OPTIONS = [0, 5, 12, 18, 28];
const SETTINGS_SINGLETON_KEY = "system";
const inferStateCodeFromGstin = (gstin) => {
  const normalized = String(gstin || "")
    .trim()
    .toUpperCase();

  if (!GSTIN_REGEX.test(normalized)) {
    return "";
  }

  return normalized.slice(0, 2);
};

const normalizeOptionalText = (value, label, { uppercase = false } = {}) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    throw new ApiError(400, `${label} must be a string.`, "VALIDATION_ERROR");
  }

  const normalized = value.trim();
  return uppercase ? normalized.toUpperCase() : normalized;
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

const normalizeObjectId = (value, label) => {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    throw new ApiError(400, `${label} is invalid.`, "INVALID_IDENTIFIER");
  }

  return normalized;
};

const getFallbackDefaults = () => ({
  business: {
    storeName: String(process.env.SHOP_NAME || "BasketIQ Store").trim(),
    gstin: String(process.env.SHOP_GST_NUMBER || "")
      .trim()
      .toUpperCase(),
    address: String(process.env.SHOP_ADDRESS || "").trim(),
    phone: String(process.env.SHOP_PHONE || "").trim(),
  },
  billing: {
    defaultGstRate: 5,
    currency: "₹",
  },
  pos: {
    allowNegativeStock: getInsufficientStockMode() === "warn",
    defaultWalkInCustomerId: null,
  },
});

const formatCustomerSummary = (customer) => {
  if (!customer) {
    return null;
  }

  return {
    _id: customer._id,
    name: customer.name,
    phone: customer.phone,
    customerType: customer.customerType || "walk_in",
  };
};

const getSettingsDocument = async () =>
  SystemSettings.findOne({ singletonKey: SETTINGS_SINGLETON_KEY });

const buildResolvedSettings = async (settingsDoc, { includeWalkInCustomer = true } = {}) => {
  const defaults = getFallbackDefaults();
  const settingsObject =
    typeof settingsDoc?.toObject === "function" ? settingsDoc.toObject() : settingsDoc || {};

  const allowNegativeStock =
    typeof settingsObject?.pos?.allowNegativeStock === "boolean"
      ? settingsObject.pos.allowNegativeStock
      : defaults.pos.allowNegativeStock;
  const configuredWalkInCustomerId =
    settingsObject?.pos?.defaultWalkInCustomerId || defaults.pos.defaultWalkInCustomerId;

  let defaultWalkInCustomer = null;

  if (includeWalkInCustomer && configuredWalkInCustomerId) {
    defaultWalkInCustomer = await Customer.findById(configuredWalkInCustomerId).select(
      "_id name phone customerType isActive"
    );
  }

  return {
    business: {
      storeName:
        normalizeOptionalText(settingsObject?.business?.storeName, "Store name") ||
        defaults.business.storeName,
      gstin:
        normalizeOptionalText(settingsObject?.business?.gstin, "GSTIN", {
          uppercase: true,
        }) || defaults.business.gstin,
      address:
        normalizeOptionalText(settingsObject?.business?.address, "Address") ||
        defaults.business.address,
      phone:
        normalizeOptionalText(settingsObject?.business?.phone, "Phone number") ||
        defaults.business.phone,
      stateCode: inferStateCodeFromGstin(
        normalizeOptionalText(settingsObject?.business?.gstin, "GSTIN", {
          uppercase: true,
        }) || defaults.business.gstin
      ),
    },
    billing: {
      defaultGstRate: DEFAULT_GST_OPTIONS.includes(
        Number(settingsObject?.billing?.defaultGstRate)
      )
        ? Number(settingsObject.billing.defaultGstRate)
        : defaults.billing.defaultGstRate,
      currency:
        normalizeOptionalText(settingsObject?.billing?.currency, "Currency") ||
        defaults.billing.currency,
    },
    pos: {
      allowNegativeStock,
      defaultWalkInCustomerId:
        defaultWalkInCustomer?._id || configuredWalkInCustomerId || null,
      defaultWalkInCustomer: formatCustomerSummary(defaultWalkInCustomer),
    },
    updatedAt: settingsObject?.updatedAt || null,
  };
};

const validateWalkInCustomer = async (customerId) => {
  if (!customerId) {
    return null;
  }

  const customer = await Customer.findById(customerId).select(
    "_id name phone customerType isActive"
  );

  if (!customer) {
    throw new ApiError(404, "Default walk-in customer not found.", "NOT_FOUND");
  }

  if (customer.isActive === false) {
    throw new ApiError(
      400,
      "Default walk-in customer must be active.",
      "VALIDATION_ERROR"
    );
  }

  if (String(customer.customerType || "").toLowerCase() !== "walk_in") {
    throw new ApiError(
      400,
      "Default walk-in customer must use walk-in customer type.",
      "VALIDATION_ERROR"
    );
  }

  return customer;
};

const normalizeSettingsPayload = async (payload = {}, currentSettings = null) => {
  const current = currentSettings || getFallbackDefaults();
  const businessPayload = payload.business || {};
  const billingPayload = payload.billing || {};
  const posPayload = payload.pos || {};

  const storeName = normalizeRequiredText(
    businessPayload.storeName ?? current.business.storeName,
    "Store name"
  );
  const gstin = normalizeOptionalText(
    businessPayload.gstin ?? current.business.gstin,
    "GSTIN",
    { uppercase: true }
  );
  const address = normalizeOptionalText(
    businessPayload.address ?? current.business.address,
    "Address"
  );
  const phone = normalizeOptionalText(
    businessPayload.phone ?? current.business.phone,
    "Phone number"
  );

  if (gstin && !GSTIN_REGEX.test(gstin)) {
    throw new ApiError(400, "Enter a valid business GSTIN.", "VALIDATION_ERROR");
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "");

    if (!PHONE_REGEX.test(phone) || digits.length < 10 || digits.length > 15) {
      throw new ApiError(
        400,
        "Enter a valid business phone number.",
        "VALIDATION_ERROR"
      );
    }
  }

  const defaultGstRate = Number(
    billingPayload.defaultGstRate ?? current.billing.defaultGstRate
  );

  if (!DEFAULT_GST_OPTIONS.includes(defaultGstRate)) {
    throw new ApiError(
      400,
      `Default GST rate must be one of ${DEFAULT_GST_OPTIONS.join(", ")}%.`,
      "VALIDATION_ERROR"
    );
  }

  const currency =
    normalizeOptionalText(
      billingPayload.currency ?? current.billing.currency,
      "Currency"
    ) || "₹";

  if (currency !== "₹") {
    throw new ApiError(
      400,
      "Only INR currency (₹) is supported in this setup.",
      "VALIDATION_ERROR"
    );
  }

  const allowNegativeStock =
    posPayload.allowNegativeStock !== undefined
      ? Boolean(posPayload.allowNegativeStock)
      : Boolean(current.pos.allowNegativeStock);
  const defaultWalkInCustomerId = normalizeObjectId(
    posPayload.defaultWalkInCustomerId ??
      current.pos.defaultWalkInCustomerId ??
      null,
    "Default walk-in customer"
  );
  const defaultWalkInCustomer = await validateWalkInCustomer(defaultWalkInCustomerId);

  return {
    business: {
      storeName,
      gstin,
      address,
      phone,
    },
    billing: {
      defaultGstRate,
      currency,
    },
    pos: {
      allowNegativeStock,
      defaultWalkInCustomerId: defaultWalkInCustomer?._id || null,
    },
  };
};

const getSettings = async (options = {}) => {
  const settingsDoc = await getSettingsDocument();
  return buildResolvedSettings(settingsDoc, options);
};

const updateSettings = async (payload = {}) => {
  const settingsDoc = await getSettingsDocument();
  const currentSettings = await buildResolvedSettings(settingsDoc, {
    includeWalkInCustomer: false,
  });
  const normalizedPayload = await normalizeSettingsPayload(payload, currentSettings);

  const nextSettings = settingsDoc
    ? Object.assign(settingsDoc, normalizedPayload)
    : new SystemSettings({
        singletonKey: SETTINGS_SINGLETON_KEY,
        ...normalizedPayload,
      });

  await nextSettings.save();
  return getSettings();
};

const getPosRuntimeSettings = async () => {
  const settings = await getSettings();

  return {
    allowNegativeStock: settings.pos.allowNegativeStock,
    defaultWalkInCustomerId: settings.pos.defaultWalkInCustomerId || null,
    defaultWalkInCustomer: settings.pos.defaultWalkInCustomer || null,
    insufficientStockMode: settings.pos.allowNegativeStock ? "warn" : "block",
    business: {
      storeName: settings.business.storeName,
      gstin: settings.business.gstin,
      address: settings.business.address,
      phone: settings.business.phone,
      stateCode: settings.business.stateCode || "",
    },
    billing: {
      defaultGstRate: settings.billing.defaultGstRate,
      currency: settings.billing.currency,
    },
  };
};

module.exports = {
  DEFAULT_GST_OPTIONS,
  getSettings,
  updateSettings,
  getPosRuntimeSettings,
};
