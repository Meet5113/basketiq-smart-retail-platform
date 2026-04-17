const mongoose = require("mongoose");

const systemSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "system",
      unique: true,
      immutable: true,
    },
    business: {
      storeName: {
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
      address: {
        type: String,
        trim: true,
        default: "",
      },
      phone: {
        type: String,
        trim: true,
        default: "",
      },
    },
    billing: {
      defaultGstRate: {
        type: Number,
        default: 5,
      },
      currency: {
        type: String,
        trim: true,
        default: "₹",
      },
    },
    pos: {
      allowNegativeStock: {
        type: Boolean,
        default: false,
      },
      defaultWalkInCustomerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

const SystemSettings =
  mongoose.models.SystemSettings ||
  mongoose.model("SystemSettings", systemSettingsSchema);

module.exports = SystemSettings;
