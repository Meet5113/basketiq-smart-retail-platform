const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const userService = require("../services/userService");

const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.getUsers();

  return sendSuccess(res, {
    message: "Users fetched successfully.",
    data: users,
  });
});

const createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);

  return sendSuccess(res, {
    statusCode: 201,
    message: "User created successfully.",
    data: user,
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user?._id);

  return sendSuccess(res, {
    message: "User updated successfully.",
    data: user,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user?._id);

  return sendSuccess(res, {
    message: "User deleted successfully.",
    data: null,
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user?._id);

  return sendSuccess(res, {
    message: "Profile fetched successfully.",
    data: user,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user?._id, req.body);

  return sendSuccess(res, {
    message: "Profile updated successfully.",
    data: user,
  });
});

const changePassword = asyncHandler(async (req, res) => {
  await userService.changePassword(req.user?._id, req.body);

  return sendSuccess(res, {
    message: "Password updated successfully.",
    data: null,
  });
});

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  changePassword,
};
