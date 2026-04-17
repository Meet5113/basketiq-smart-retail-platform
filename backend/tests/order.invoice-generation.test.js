const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const InvoiceCounter = require("../models/InvoiceCounter");
const SystemSettings = require("../models/SystemSettings");
const { createOrder } = require("../services/orderService");

const buildMongoUri = () => {
  if (process.env.MONGO_TEST_URI) {
    return process.env.MONGO_TEST_URI;
  }

  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `mongodb://127.0.0.1:27017/basketiq_invoice_generation_${suffix}`;
};

const createBillingPayload = ({ productId, customerId, quantity = 1 }) => ({
  customerId,
  paymentMethod: "cash",
  items: [
    {
      productId: String(productId),
      quantity,
      discountType: "flat",
      discountValue: 0,
    },
  ],
});

test("createOrder generates unique backend invoice numbers for sequential and rapid POS bills", async (t) => {
  const mongoUri = buildMongoUri();

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
  } catch (error) {
    t.skip(`MongoDB is unavailable for invoice integration tests: ${error.message}`);
    return;
  }

  try {
    await Promise.all([
      Product.init(),
      Customer.init(),
      Order.init(),
      InvoiceCounter.init(),
      SystemSettings.init(),
    ]);

    await SystemSettings.create({
      singletonKey: "system",
      business: {
        storeName: "BasketIQ Test Store",
        gstin: "27ABCDE1234F1Z5",
        phone: "9876543210",
      },
      billing: {
        defaultGstRate: 18,
        currency: "₹",
      },
      pos: {
        allowNegativeStock: false,
      },
    });

    const product = await Product.create({
      name: "Test Rice Bag",
      sku: "TEST-RICE-01",
      category: "Groceries",
      unitType: "bag",
      sellingPrice: 100,
      price: 100,
      costPrice: 60,
      gstRate: 18,
      taxType: "exclusive",
      stock: 50,
      reorderPoint: 5,
    });

    const customer = await Customer.create({
      name: "Invoice Test Customer",
      phone: "9999999999",
      customerType: "regular",
    });

    const firstOrder = await createOrder(
      createBillingPayload({ productId: product._id, customerId: customer._id })
    );
    const secondOrder = await createOrder(
      createBillingPayload({ productId: product._id, customerId: customer._id })
    );

    const currentYear = new Date().getFullYear();
    assert.equal(firstOrder.invoiceNumber, `INV-${currentYear}-001`);
    assert.equal(secondOrder.invoiceNumber, `INV-${currentYear}-002`);

    await InvoiceCounter.deleteMany({});

    const afterCounterResetOrder = await createOrder(
      createBillingPayload({ productId: product._id, customerId: customer._id })
    );

    assert.equal(afterCounterResetOrder.invoiceNumber, `INV-${currentYear}-003`);

    const rapidOrders = await Promise.all(
      Array.from({ length: 3 }, () =>
        createOrder(createBillingPayload({ productId: product._id, customerId: customer._id }))
      )
    );

    const invoiceNumbers = [
      firstOrder.invoiceNumber,
      secondOrder.invoiceNumber,
      afterCounterResetOrder.invoiceNumber,
      ...rapidOrders.map((order) => order.invoiceNumber),
    ];
    const sortedInvoiceNumbers = [...invoiceNumbers].sort();
    const persistedOrders = await Order.find({}).sort({ invoiceNumber: 1 }).lean();
    const reloadedProduct = await Product.findById(product._id).lean();
    const counter = await InvoiceCounter.findById(`invoice:${currentYear}`).lean();

    assert.equal(new Set(invoiceNumbers).size, invoiceNumbers.length);
    assert.deepEqual(sortedInvoiceNumbers, [
      `INV-${currentYear}-001`,
      `INV-${currentYear}-002`,
      `INV-${currentYear}-003`,
      `INV-${currentYear}-004`,
      `INV-${currentYear}-005`,
      `INV-${currentYear}-006`,
    ]);
    assert.equal(persistedOrders.length, 6);
    assert.deepEqual(
      persistedOrders.map((order) => order.invoiceNumber),
      sortedInvoiceNumbers
    );
    assert.equal(reloadedProduct.stock, 44);
    assert.equal(counter.sequence, 6);
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
