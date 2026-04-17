const mongoose = require("mongoose");

const customerStatsSchema = new mongoose.Schema(
  {
    orderCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalSpend: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastPurchaseDate: {
      type: Date,
      default: null,
    },
    averageOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
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
    customerType: {
      type: String,
      enum: ["walk_in", "regular", "business"],
      default: "regular",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    stats: {
      type: customerStatsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({ phone: 1 });
customerSchema.index({ customerType: 1, isActive: 1 });
customerSchema.index({ "stats.totalSpend": -1, "stats.orderCount": -1 });

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

module.exports = Customer;
