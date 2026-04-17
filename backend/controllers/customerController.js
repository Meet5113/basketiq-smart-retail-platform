const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const customerService = require("../services/customerService");

const createCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.createCustomer(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Customer created successfully.",
    data: customer,
  });
});

const getCustomers = asyncHandler(async (req, res) => {
  const customers = await customerService.getCustomers(req.query);

  return sendSuccess(res, {
    message: "Customers fetched successfully.",
    data: Array.isArray(customers) ? customers : [],
  });
});

const getCustomerById = asyncHandler(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id);

  return sendSuccess(res, {
    message: "Customer fetched successfully.",
    data: customer,
  });
});

const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body);

  return sendSuccess(res, {
    message: "Customer updated successfully.",
    data: customer,
  });
});

const updateCustomerStatus = asyncHandler(async (req, res) => {
  const customer = await customerService.updateCustomerStatus(
    req.params.id,
    req.body?.isActive
  );

  return sendSuccess(res, {
    message: "Customer status updated successfully.",
    data: customer,
  });
});

const deleteCustomer = asyncHandler(async (req, res) => {
  await customerService.deleteCustomer(req.params.id);

  return sendSuccess(res, {
    message: "Customer deleted successfully.",
    data: [],
  });
});

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  updateCustomerStatus,
  deleteCustomer,
};
