const mongoose = require("mongoose");

const GST_SLABS = [0, 5, 12, 18, 28];
const STOCK_MOVEMENT_TYPES = [
  "OPENING_STOCK",
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "SALE_DEDUCTION",
];
const LEGACY_STOCK_MOVEMENT_TYPE_MAP = {
  OPENING: "OPENING_STOCK",
  IN: "STOCK_IN",
  OUT: "STOCK_OUT",
  SOLD: "SALE_DEDUCTION",
  SALE: "SALE_DEDUCTION",
};

const normalizeLegacyStockMovementType = (value, changeQty = 0) => {
  const normalized = String(value || "").trim().toUpperCase();

  if (STOCK_MOVEMENT_TYPES.includes(normalized)) {
    return normalized;
  }

  if (LEGACY_STOCK_MOVEMENT_TYPE_MAP[normalized]) {
    return LEGACY_STOCK_MOVEMENT_TYPE_MAP[normalized];
  }

  if (normalized === "CANCELLED") {
    return Number(changeQty) < 0 ? "STOCK_OUT" : "STOCK_IN";
  }

  if (Number(changeQty) > 0) {
    return "STOCK_IN";
  }

  if (Number(changeQty) < 0) {
    return "STOCK_OUT";
  }

  return "ADJUSTMENT";
};

const attributeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      default: "",
    },
    value: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
      required: true,
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const stockHistorySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: STOCK_MOVEMENT_TYPES,
      required: true,
    },
    beforeQty: {
      type: Number,
      default: 0,
    },
    changeQty: {
      type: Number,
      required: true,
      default: 0,
    },
    afterQty: {
      type: Number,
      default: 0,
    },
    referenceType: {
      type: String,
      enum: ["ORDER", "MANUAL", "SYSTEM"],
      default: "SYSTEM",
    },
    referenceId: {
      type: String,
      trim: true,
      default: "",
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    performedByName: {
      type: String,
      trim: true,
      default: "",
    },
    performedByRole: {
      type: String,
      trim: true,
      default: "",
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    unitPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    unitType: {
      type: String,
      trim: true,
      default: "unit",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    shortDescription: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    attributes: {
      type: [attributeSchema],
      default: [],
    },
    specifications: {
      type: [attributeSchema],
      default: [],
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    sellingPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    price: {
      type: Number,
      min: 0,
      default: 0,
    },
    gstRate: {
      type: Number,
      enum: GST_SLABS,
      default: 5,
    },
    taxType: {
      type: String,
      enum: ["exclusive", "inclusive", "exempt"],
      default: "exclusive",
    },
    hsnSacCode: {
      type: String,
      trim: true,
      default: "",
    },
    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },
    stock: {
      type: Number,
      default: 0,
    },
    minStock: {
      type: Number,
      min: 0,
      default: 0,
    },
    maxStock: {
      type: Number,
      min: 0,
      default: 0,
    },
    reorderPoint: {
      type: Number,
      min: 0,
      default: 0,
    },
    barcode: {
      type: String,
      trim: true,
      default: "",
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    primaryImage: {
      type: String,
      trim: true,
      default: "",
    },
    stockHistory: {
      type: [stockHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sku: { $exists: true, $type: "string", $gt: "" },
    },
  }
);

productSchema.pre("validate", function syncLegacyFields() {
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const safeNonNegative = (value) => (value === null ? 0 : Math.max(0, value));

  const selling = numeric(this.sellingPrice);
  const legacyPrice = numeric(this.price);
  const stock = numeric(this.stock);
  const cost = numeric(this.costPrice);

  const normalizedSelling = safeNonNegative(selling !== null ? selling : legacyPrice);
  const normalizedStock = stock === null ? 0 : Math.round(stock * 100) / 100;
  const normalizedCost = safeNonNegative(cost);

  this.sellingPrice = normalizedSelling;
  this.price = normalizedSelling;
  this.stock = normalizedStock;
  this.costPrice = normalizedCost;

  const normalizedHsnCode = String(this.hsnCode || this.hsnSacCode || "").trim().toUpperCase();
  this.hsnCode = normalizedHsnCode;
  this.hsnSacCode = normalizedHsnCode;

  if (this.taxType === "exempt") {
    this.gstRate = 0;
  } else if (!GST_SLABS.includes(Number(this.gstRate))) {
    this.gstRate = 5;
  }

  if (!this.primaryImage && Array.isArray(this.images) && this.images.length > 0) {
    const selected = this.images.find((image) => image?.isPrimary) || this.images[0];
    this.primaryImage = selected?.url || "";
  }

  const explicitPrimary = Array.isArray(this.images)
    ? this.images.find((image) => image?.url && image.url === this.primaryImage)
    : null;

  if (Array.isArray(this.images) && this.images.length > 0) {
    this.images = this.images.map((image) => ({
      ...image,
      isPrimary: explicitPrimary ? image.url === explicitPrimary.url : false,
    }));

    if (!explicitPrimary) {
      this.images[0].isPrimary = true;
      this.primaryImage = this.images[0].url;
    }
  }

  if (Array.isArray(this.stockHistory) && this.stockHistory.length > 0) {
    this.stockHistory = this.stockHistory.map((entry) => {
      const normalizedEntry =
        typeof entry?.toObject === "function" ? entry.toObject() : { ...entry };

      return {
        ...normalizedEntry,
        type: normalizeLegacyStockMovementType(
          normalizedEntry?.type,
          normalizedEntry?.changeQty
        ),
      };
    });
  }
});

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = Product;
