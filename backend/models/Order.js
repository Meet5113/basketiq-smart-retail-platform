const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      trim: true,
      default: "unit",
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    lineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    discountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    cartDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxType: {
      type: String,
      enum: ["exclusive", "inclusive", "exempt"],
      default: "exclusive",
    },
    taxRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    cgstRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    cgstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    sgstRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    sgstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    igstRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    igstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    finalLineTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    lineAmountWithTax: {
      type: Number,
      min: 0,
      default: 0,
    },
    profitAmount: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const splitPaymentSchema = new mongoose.Schema(
  {
    cashAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    upiAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const invoicePartySchema = new mongoose.Schema(
  {
    legalName: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    stateCode: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
  },
  { _id: false }
);

const taxBreakdownSchema = new mongoose.Schema(
  {
    hsnCode: { type: String, trim: true, default: "" },
    taxRate: { type: Number, min: 0, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    cgstAmount: { type: Number, min: 0, default: 0 },
    sgstAmount: { type: Number, min: 0, default: 0 },
    igstAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
      default: "Walk-in Customer",
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    customerAddress: {
      type: String,
      trim: true,
      default: "",
    },
    customerGstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    customerStateCode: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceCategory: {
      type: String,
      enum: ["b2b", "b2c"],
      default: "b2c",
    },
    sellerDetails: {
      type: invoicePartySchema,
      default: () => ({}),
    },
    buyerDetails: {
      type: invoicePartySchema,
      default: () => ({}),
    },
    items: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    taxableAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    costAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    profitAmount: {
      type: Number,
      default: 0,
    },
    gstRate: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    cgstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    sgstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    igstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    supplyType: {
      type: String,
      enum: ["intra", "inter"],
      default: "intra",
    },
    placeOfSupply: {
      type: String,
      trim: true,
      default: "",
    },
    taxBreakdown: {
      type: [taxBreakdownSchema],
      default: [],
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    itemDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    cartDiscountType: {
      type: String,
      enum: ["flat", "percent"],
      default: "flat",
    },
    cartDiscountValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    cartDiscountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["completed", "cancelled", "refunded"],
      default: "completed",
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "split"],
      default: "cash",
      required: true,
    },
    splitPayment: {
      type: splitPaymentSchema,
      default: () => ({ cashAmount: 0, upiAmount: 0 }),
    },
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 16,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: true,
    },
  }
);

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

module.exports = Order;
