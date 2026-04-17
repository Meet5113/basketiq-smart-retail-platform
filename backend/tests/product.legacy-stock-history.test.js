const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const { updateProduct } = require("../services/productService");

const buildMongoUri = () => {
  if (process.env.MONGO_TEST_URI) {
    return process.env.MONGO_TEST_URI;
  }

  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `mongodb://127.0.0.1:27017/basketiq_product_legacy_stock_${suffix}`;
};

test("updateProduct normalizes legacy stock history movement types before validation", async (t) => {
  const mongoUri = buildMongoUri();

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
  } catch (error) {
    t.skip(`MongoDB is unavailable for legacy product tests: ${error.message}`);
    return;
  }

  try {
    await Product.init();

    const productId = new mongoose.Types.ObjectId();

    await Product.collection.insertOne({
      _id: productId,
      name: "Apple",
      sku: "APPLE-002",
      category: "Fruits",
      brand: "Adani Farms",
      unitType: "kg",
      status: "active",
      costPrice: 80,
      sellingPrice: 100,
      price: 100,
      gstRate: 5,
      taxType: "exclusive",
      stock: 20,
      stockHistory: [
        {
          type: "IN",
          beforeQty: 0,
          changeQty: 10,
          afterQty: 10,
          referenceType: "MANUAL",
          date: new Date("2026-04-01T00:00:00.000Z"),
        },
        {
          type: "OUT",
          beforeQty: 10,
          changeQty: -2,
          afterQty: 8,
          referenceType: "ORDER",
          date: new Date("2026-04-02T00:00:00.000Z"),
        },
        {
          type: "CANCELLED",
          beforeQty: 8,
          changeQty: 2,
          afterQty: 10,
          referenceType: "SYSTEM",
          date: new Date("2026-04-03T00:00:00.000Z"),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const updatedProduct = await updateProduct(String(productId), {
      name: "Apple Premium",
      sku: "APPLE-002",
      category: "Fruits",
      brand: "Adani Farms",
      unitType: "kg",
      barcode: "123456",
      status: "active",
      costPrice: 85,
      sellingPrice: 110,
      gstRate: 5,
      shortDescription: "Fresh fruit",
    });

    assert.equal(updatedProduct.name, "Apple Premium");
    assert.deepEqual(
      updatedProduct.inventoryLogs.map((entry) => entry.type),
      ["STOCK_IN", "STOCK_OUT", "STOCK_IN"]
    );

    const persistedProduct = await Product.findById(productId).lean();

    assert.deepEqual(
      persistedProduct.stockHistory.map((entry) => entry.type),
      ["STOCK_IN", "STOCK_OUT", "STOCK_IN"]
    );
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
