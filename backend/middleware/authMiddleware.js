const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("./asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Not authorized, token missing.", "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    throw new ApiError(401, "Not authorized, token missing.", "UNAUTHORIZED");
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError(500, "JWT secret is not configured.", "CONFIG_ERROR");
  }

  let decoded;

  try {
    decoded = jwt.verify(token, secret);
  } catch {
    throw new ApiError(401, "Not authorized, token invalid.", "INVALID_TOKEN");
  }

  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    throw new ApiError(401, "Not authorized, user not found.", "UNAUTHORIZED");
  }

  if (user.isActive === false) {
    throw new ApiError(403, "Your account is inactive. Contact an admin to restore access.", "ACCOUNT_INACTIVE");
  }

  req.user = user;
  return next();
});

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Not authorized, user context missing.", "UNAUTHORIZED"));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new ApiError(403, "Access denied for your role.", "FORBIDDEN"));
  }

  return next();
};

module.exports = {
  protect,
  authorizeRoles,
};
