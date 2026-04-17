const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const authService = require("../services/authService");

const registerUser = asyncHandler(async (req, res) => {
  const authPayload = await authService.registerUser(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "User registered successfully.",
    data: authPayload,
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const authPayload = await authService.loginUser(req.body);

  return sendSuccess(res, {
    statusCode: 200,
    message: "Login successful.",
    data: authPayload,
  });
});

module.exports = {
  registerUser,
  loginUser,
};
