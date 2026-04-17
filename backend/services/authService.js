const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const ApiError = require("../utils/ApiError");
const { normalizeAllowedModules } = require("../utils/userAccess");

const ALLOWED_ROLES = ["admin", "staff"];

const sanitizeAuthUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl || "",
  isActive: user.isActive !== false,
  allowedModules: normalizeAllowedModules(user.role, user.allowedModules),
  token: generateToken({ id: user._id, role: user.role }),
});

const registerUser = async ({ name, email, password, role }) => {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();
  const normalizedRole = String(role || "staff").trim().toLowerCase();

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    throw new ApiError(400, "Name, email, and password are required.", "VALIDATION_ERROR");
  }

  if (normalizedPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long.", "VALIDATION_ERROR");
  }

  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw new ApiError(400, "Role must be admin or staff.", "VALIDATION_ERROR");
  }

  const allowAdminSignup = process.env.ALLOW_ADMIN_SIGNUP === "true";

  if (normalizedRole === "admin" && !allowAdminSignup) {
    throw new ApiError(
      403,
      "Admin account creation is restricted. Contact an existing admin.",
      "FORBIDDEN"
    );
  }

  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    throw new ApiError(409, "User already exists.", "USER_EXISTS");
  }

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
    role: normalizedRole,
    isActive: true,
    allowedModules: normalizeAllowedModules(normalizedRole, []),
  });

  return sanitizeAuthUser(user);
};

const loginUser = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");

  if (!normalizedEmail || !normalizedPassword) {
    throw new ApiError(400, "Email and password are required.", "VALIDATION_ERROR");
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  if (user.isActive === false) {
    throw new ApiError(403, "Your account is inactive. Contact an admin to restore access.", "ACCOUNT_INACTIVE");
  }

  const isPasswordMatch = await bcrypt.compare(normalizedPassword, user.password);

  if (!isPasswordMatch) {
    throw new ApiError(401, "Invalid email or password.", "INVALID_CREDENTIALS");
  }

  return sanitizeAuthUser(user);
};

module.exports = {
  registerUser,
  loginUser,
};
