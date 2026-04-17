const mongoose = require("mongoose");

const ledgerEntrySchema = new mongoose.Schema(
  {
    ledgerType: {
      type: String,
      enum: ["customer"],
      required: true,
      index: true,
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: ["debit", "credit"],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    referenceType: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    referenceId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: "",
    },
    note: {
      type: String,
      trim: true,
      default: "",
    },
    entryDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

ledgerEntrySchema.index({ ledgerType: 1, partyId: 1, entryDate: -1, _id: -1 });

const LedgerEntry =
  mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", ledgerEntrySchema);

module.exports = LedgerEntry;
