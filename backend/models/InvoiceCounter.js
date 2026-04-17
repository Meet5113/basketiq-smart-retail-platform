const mongoose = require("mongoose");

const invoiceCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      trim: true,
    },
    sequence: {
      type: Number,
      min: 0,
      default: 0,
    },
    year: {
      type: Number,
      required: true,
    },
    prefix: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const InvoiceCounter =
  mongoose.models.InvoiceCounter || mongoose.model("InvoiceCounter", invoiceCounterSchema);

module.exports = InvoiceCounter;
