const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");

const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const RECENT_ORDER_LIMIT = 12;
const NOTIFICATION_LIMIT = 20;

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const getLowStockThreshold = (product) => {
  const reorderPoint = Number(product?.reorderPoint || 0);
  return reorderPoint > 0 ? reorderPoint : DEFAULT_LOW_STOCK_THRESHOLD;
};

const buildLowStockEvents = async () => {
  const products = await Product.find({})
    .select("_id name sku stock reorderPoint updatedAt")
    .sort({ stock: 1, name: 1 });

  return products
    .filter((product) => Number(product?.stock || 0) <= getLowStockThreshold(product))
    .map((product) => {
      const stock = Number(product?.stock || 0);
      const threshold = getLowStockThreshold(product);

      return {
        eventKey: `low-stock:${String(product._id)}`,
        type: "low_stock",
        title: stock <= 0 ? `${product.name} is out of stock` : `${product.name} is running low`,
        description: `Stock ${stock} • Threshold ${threshold}`,
        href: `/inventory/history?productId=${String(product._id)}`,
        relatedModule: "inventory",
        relatedRecordId: String(product._id),
        eventTimestamp: product.updatedAt || new Date(),
        metadata: {
          productId: String(product._id),
          sku: product.sku || "",
          stock,
          threshold,
        },
      };
    });
};

const buildOrderEvents = async () => {
  const orders = await Order.find({})
    .select("_id invoiceNumber customerName finalAmount totalAmount status createdAt")
    .sort({ createdAt: -1 })
    .limit(RECENT_ORDER_LIMIT);

  return orders.map((order) => {
    const normalizedStatus = String(order?.status || "completed").toLowerCase();
    const amount = Number(order?.finalAmount ?? order?.totalAmount ?? 0);

    return {
      eventKey: `order:${String(order._id)}:${normalizedStatus}`,
      type: "order",
      title: `Order ${order.invoiceNumber || String(order._id).slice(-6)} ${normalizedStatus}`,
      description: `${order.customerName || "Walk-in Customer"} • ₹${amount.toFixed(2)}`,
      href: `/orders/${String(order._id)}`,
      relatedModule: "orders",
      relatedRecordId: String(order._id),
      eventTimestamp: order.createdAt || new Date(),
      metadata: {
        orderId: String(order._id),
        invoiceNumber: order.invoiceNumber || "",
        status: normalizedStatus,
      },
    };
  });
};

const syncNotifications = async () => {
  const [lowStockEvents, orderEvents] = await Promise.all([
    buildLowStockEvents(),
    buildOrderEvents(),
  ]);
  const allEvents = [...lowStockEvents, ...orderEvents];

  if (allEvents.length > 0) {
    await Promise.all(
      allEvents.map((event) =>
        Notification.findOneAndUpdate(
          { eventKey: event.eventKey },
          {
            $set: {
              type: event.type,
              title: event.title,
              description: event.description,
              href: event.href,
              relatedModule: event.relatedModule,
              relatedRecordId: event.relatedRecordId,
              eventTimestamp: event.eventTimestamp,
              metadata: event.metadata,
              active: true,
            },
          },
          {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true,
          }
        )
      )
    );
  }

  const activeLowStockKeys = lowStockEvents.map((event) => event.eventKey);
  const activeOrderKeys = orderEvents.map((event) => event.eventKey);
  await Notification.updateMany(
    {
      type: "low_stock",
      ...(activeLowStockKeys.length > 0
        ? { eventKey: { $nin: activeLowStockKeys } }
        : {}),
    },
    {
      $set: {
        active: false,
      },
    }
  );

  await Notification.updateMany(
    {
      type: "order",
      ...(activeOrderKeys.length > 0 ? { eventKey: { $nin: activeOrderKeys } } : {}),
    },
    {
      $set: {
        active: false,
      },
    }
  );
};

const serializeNotification = (notification, userId) => {
  const record =
    typeof notification?.toObject === "function"
      ? notification.toObject()
      : notification || {};
  const readBy = Array.isArray(record.readBy) ? record.readBy : [];
  const normalizedUserId = String(userId || "");

  return {
    _id: record._id,
    id: record._id,
    type: record.type,
    title: record.title,
    description: record.description,
    href: record.href,
    relatedModule: record.relatedModule,
    relatedRecordId: record.relatedRecordId,
    timestamp: record.eventTimestamp || record.createdAt,
    isRead: readBy.some((entry) => String(entry) === normalizedUserId),
    metadata: record.metadata || {},
  };
};

const getNotifications = async (userId) => {
  validateObjectId(userId, "user");
  await syncNotifications();

  const notifications = await Notification.find({ active: true })
    .sort({ eventTimestamp: -1, updatedAt: -1 })
    .limit(NOTIFICATION_LIMIT);

  const items = notifications.map((notification) =>
    serializeNotification(notification, userId)
  );
  const unreadCount = items.filter((item) => !item.isRead).length;

  return {
    unreadCount,
    items,
  };
};

const markNotificationAsRead = async (userId, notificationId) => {
  validateObjectId(userId, "user");
  validateObjectId(notificationId, "notification");

  const notification = await Notification.findByIdAndUpdate(
    notificationId,
    {
      $addToSet: {
        readBy: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      new: true,
    }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found.", "NOT_FOUND");
  }

  return serializeNotification(notification, userId);
};

const markAllNotificationsAsRead = async (userId) => {
  validateObjectId(userId, "user");

  await Notification.updateMany(
    {
      active: true,
      readBy: { $ne: new mongoose.Types.ObjectId(userId) },
    },
    {
      $addToSet: {
        readBy: new mongoose.Types.ObjectId(userId),
      },
    }
  );

  return getNotifications(userId);
};

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
