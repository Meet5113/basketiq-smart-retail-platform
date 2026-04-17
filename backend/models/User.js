const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ALL_MODULES } = require("../utils/userAccess");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "staff"],
      default: "staff",
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    allowedModules: {
      type: [String],
      enum: ALL_MODULES,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function preSave() {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;
