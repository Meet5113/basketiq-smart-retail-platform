const asyncHandler = require("../middleware/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const notificationService = require("../services/notificationService");

const getNotifications = asyncHandler(async (req, res) => {
  const data = await notificationService.getNotifications(req.user?._id);

  return sendSuccess(res, {
    message: "Notifications fetched successfully.",
    data: data.items,
    meta: {
      unreadCount: data.unreadCount,
    },
  });
});

const markNotificationAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markNotificationAsRead(
    req.user?._id,
    req.params.id
  );

  return sendSuccess(res, {
    message: "Notification marked as read.",
    data: notification,
  });
});

const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllNotificationsAsRead(req.user?._id);

  return sendSuccess(res, {
    message: "All notifications marked as read.",
    data: data.items,
    meta: {
      unreadCount: data.unreadCount,
    },
  });
});

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
