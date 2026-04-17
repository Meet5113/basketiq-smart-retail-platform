const mongoose = require("mongoose");

const STOCK_MOVEMENT_TYPES = [
  "OPENING_STOCK",
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "SALE_DEDUCTION",
];

const stockLedgerSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: STOCK_MOVEMENT_TYPES,
      required: true,
      index: true,
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
      trim: true,
      default: "",
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
    performedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      name: {
        type: String,
        trim: true,
        default: "",
      },
      role: {
        type: String,
        trim: true,
        default: "",
      },
    },
    movementDate: {
      type: Date,
      default: Date.now,
      index: true,
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
    totalCost: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

stockLedgerSchema.index({ productId: 1, movementDate: -1, _id: -1 });

const StockLedger =
  mongoose.models.StockLedger || mongoose.model("StockLedger", stockLedgerSchema);

module.exports = StockLedger;
