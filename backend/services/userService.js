const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { ALL_MODULES, normalizeAllowedModules } = require("../utils/userAccess");

const ALLOWED_ROLES = ["admin", "staff"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl || "",
  isActive: user.isActive !== false,
  allowedModules: normalizeAllowedModules(user.role, user.allowedModules),
  createdAt: user.createdAt,
});

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const validateEmail = (email) => {
  if (!EMAIL_REGEX.test(email)) {
    throw new ApiError(400, "Enter a valid email address.", "VALIDATION_ERROR");
  }
};

const ensureAnotherAdminExists = async (userId) => {
  const adminCount = await User.countDocuments({
    role: "admin",
    _id: { $ne: userId },
    isActive: { $ne: false },
  });

  if (adminCount <= 0) {
    throw new ApiError(400, "At least one active admin user is required.", "VALIDATION_ERROR");
  }
};

const getUsers = async () => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  return users.map((user) => sanitizeUser(user));
};

const createUser = async ({ name, email, password, role, allowedModules }) => {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");
  const normalizedRole = String(role || "staff").toLowerCase();

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    throw new ApiError(400, "Name, email, and password are required.", "VALIDATION_ERROR");
  }

  validateEmail(normalizedEmail);

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw new ApiError(400, "Role must be admin or staff.", "VALIDATION_ERROR");
  }

  if (normalizedPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long.", "VALIDATION_ERROR");
  }

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new ApiError(409, "A user with this email already exists.", "USER_EXISTS");
  }

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
    role: normalizedRole,
    isActive: true,
    allowedModules: normalizeAllowedModules(normalizedRole, allowedModules),
  });

  return sanitizeUser(user);
};

const updateUser = async (id, payload = {}, currentUserId = null) => {
  validateObjectId(id, "user");

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found.", "NOT_FOUND");
  }

  const nextName = payload.name !== undefined ? String(payload.name || "").trim() : user.name;
  const nextEmail =
    payload.email !== undefined ? String(payload.email || "").trim().toLowerCase() : user.email;
  const nextRole = payload.role !== undefined ? String(payload.role || "").toLowerCase() : user.role;
  const nextIsActive = payload.isActive !== undefined ? Boolean(payload.isActive) : user.isActive !== false;
  const nextAvatarUrl =
    payload.avatarUrl !== undefined ? String(payload.avatarUrl || "").trim() : user.avatarUrl || "";
  const nextAllowedModules = normalizeAllowedModules(
    nextRole,
    payload.allowedModules !== undefined ? payload.allowedModules : user.allowedModules
  );

  if (!nextName || !nextEmail) {
    throw new ApiError(400, "Name and email are required.", "VALIDATION_ERROR");
  }

  validateEmail(nextEmail);

  if (!ALLOWED_ROLES.includes(nextRole)) {
    throw new ApiError(400, "Role must be admin or staff.", "VALIDATION_ERROR");
  }

  const duplicateUser = await User.findOne({
    email: nextEmail,
    _id: { $ne: user._id },
  });

  if (duplicateUser) {
    throw new ApiError(409, "A user with this email already exists.", "USER_EXISTS");
  }

  const isSelfUpdate = currentUserId && String(currentUserId) === String(user._id);

  if (isSelfUpdate && (user.role !== nextRole || (user.isActive !== false) !== nextIsActive)) {
    throw new ApiError(
      400,
      "You cannot change your own role or active status from this page.",
      "VALIDATION_ERROR"
    );
  }

  if (user.role === "admin" && (nextRole !== "admin" || nextIsActive === false)) {
    await ensureAnotherAdminExists(user._id);
  }

  user.name = nextName;
  user.email = nextEmail;
  user.role = nextRole;
  user.avatarUrl = nextAvatarUrl;
  user.isActive = nextIsActive;
  user.allowedModules = nextAllowedModules;
  await user.save();

  return sanitizeUser(user);
};

const deleteUser = async (id, currentUserId) => {
  validateObjectId(id, "user");

  if (String(currentUserId) === id) {
    throw new ApiError(400, "You cannot delete your own account.", "VALIDATION_ERROR");
  }

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found.", "NOT_FOUND");
  }

  if (user.role === "admin" && user.isActive !== false) {
    await ensureAnotherAdminExists(user._id);
  }

  await user.deleteOne();
  return null;
};

const getProfile = async (userId) => {
  validateObjectId(userId, "user");
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found.", "NOT_FOUND");
  }

  return sanitizeUser(user);
};

const updateProfile = async (userId, payload = {}) => {
  validateObjectId(userId, "user");
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.", "NOT_FOUND");
  }

  const nextName =
    payload.name !== undefined ? String(payload.name || "").trim() : user.name;
  const nextEmail =
    payload.email !== undefined
      ? String(payload.email || "").trim().toLowerCase()
      : user.email;
  const nextAvatarUrl =
    payload.avatarUrl !== undefined
      ? String(payload.avatarUrl || "").trim()
      : user.avatarUrl || "";

  if (!nextName || !nextEmail) {
    throw new ApiError(400, "Name and email are required.", "VALIDATION_ERROR");
  }

  validateEmail(nextEmail);

  const duplicateUser = await User.findOne({
    email: nextEmail,
    _id: { $ne: user._id },
  });

  if (duplicateUser) {
    throw new ApiError(409, "A user with this email already exists.", "USER_EXISTS");
  }

  user.name = nextName;
  user.email = nextEmail;
  user.avatarUrl = nextAvatarUrl;
  await user.save();

  return sanitizeUser(user);
};

const changePassword = async (userId, payload = {}) => {
  validateObjectId(userId, "user");
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found.", "NOT_FOUND");
  }

  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");

  if (!currentPassword || !newPassword) {
    throw new ApiError(
      400,
      "Current password and new password are required.",
      "VALIDATION_ERROR"
    );
  }

  if (newPassword.length < 6) {
    throw new ApiError(
      400,
      "New password must be at least 6 characters long.",
      "VALIDATION_ERROR"
    );
  }

  const isPasswordMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(400, "Current password is incorrect.", "VALIDATION_ERROR");
  }

  if (currentPassword === newPassword) {
    throw new ApiError(
      400,
      "New password must be different from the current password.",
      "VALIDATION_ERROR"
    );
  }

  user.password = newPassword;
  await user.save();

  return {
    success: true,
  };
};

module.exports = {
  ALL_MODULES,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  changePassword,
};
