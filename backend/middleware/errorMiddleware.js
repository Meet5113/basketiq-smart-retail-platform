const ApiError = require("../utils/ApiError");

const buildErrorPayload = (err) => {
  if (err.name === "ValidationError") {
    return {
      statusCode: 400,
      message: "Validation failed.",
      code: "VALIDATION_ERROR",
      details: Object.values(err.errors || {}).map((item) => item.message),
    };
  }

  if (err.name === "CastError") {
    return {
      statusCode: 400,
      message: "Invalid identifier format.",
      code: "INVALID_IDENTIFIER",
      details: err.path,
    };
  }

  if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyValue || {});
    const duplicateField = duplicateFields[0];
    const duplicateValue = duplicateField ? err.keyValue?.[duplicateField] : null;

    return {
      statusCode: 409,
      message:
        duplicateField === "sku"
          ? `SKU "${duplicateValue}" already exists.`
          : duplicateField === "invoiceNumber"
            ? "Another bill was generated at the same time. Please retry bill generation."
          : "Duplicate value conflict.",
      code: "DUPLICATE_KEY",
      details: err.keyValue || null,
    };
  }

  if (err.name === "JsonWebTokenError") {
    return {
      statusCode: 401,
      message: "Invalid authentication token.",
      code: "INVALID_TOKEN",
    };
  }

  if (err.name === "TokenExpiredError") {
    return {
      statusCode: 401,
      message: "Authentication token expired.",
      code: "TOKEN_EXPIRED",
    };
  }

  if (err.message === "CORS blocked for this origin.") {
    return {
      statusCode: 403,
      message: err.message,
      code: "CORS_BLOCKED",
    };
  }

  return null;
};

const notFound = (req, res, next) => {
  next(new ApiError(404, "Route not found.", "ROUTE_NOT_FOUND"));
};

const errorHandler = (err, req, res, next) => {
  const normalizedError = err instanceof ApiError ? err : null;
  const mappedError = normalizedError ? null : buildErrorPayload(err);

  const statusCode = normalizedError?.statusCode || mappedError?.statusCode || 500;
  const code = normalizedError?.code || mappedError?.code || "INTERNAL_ERROR";
  const message = normalizedError?.message || mappedError?.message || "Internal server error.";
  const details = normalizedError?.details ?? mappedError?.details ?? null;

  if (statusCode >= 500) {
    console.error("Unhandled server error:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      ...(details ? { details } : {}),
    },
  });
};

module.exports = {
  notFound,
  errorHandler,
};
