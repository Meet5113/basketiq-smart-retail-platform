const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const productService = require("../services/productService");

const truncateLargeStrings = (value) => {
  if (typeof value === "string") {
    return value.length > 240 ? `${value.slice(0, 240)}...[truncated ${value.length - 240} chars]` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => truncateLargeStrings(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, truncateLargeStrings(item)])
    );
  }

  return value;
};

const createProduct = asyncHandler(async (req, res) => {
  console.info("Create product request body:", truncateLargeStrings(req.body));
  const product = await productService.createProduct(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Product created successfully.",
    data: product,
  });
});

const getProducts = asyncHandler(async (req, res) => {
  const products = await productService.getProducts(req.query);

  return sendSuccess(res, {
    message: "Products fetched successfully.",
    data: Array.isArray(products) ? products : [],
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);

  return sendSuccess(res, {
    message: "Product fetched successfully.",
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);

  return sendSuccess(res, {
    message: "Product updated successfully.",
    data: product,
  });
});

const updateProductStatus = asyncHandler(async (req, res) => {
  const product = await productService.updateProductStatus(req.params.id, req.body?.status);

  return sendSuccess(res, {
    message: "Product status updated successfully.",
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);

  return sendSuccess(res, {
    message: "Product deleted successfully.",
    data: [],
  });
});

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  updateProductStatus,
  deleteProduct,
};
