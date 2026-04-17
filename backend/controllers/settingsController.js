const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const settingsService = require("../services/settingsService");

const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings();

  return sendSuccess(res, {
    message: "Settings fetched successfully.",
    data: settings,
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.body);

  return sendSuccess(res, {
    message: "Settings updated successfully.",
    data: settings,
  });
});

module.exports = {
  getSettings,
  updateSettings,
};
