const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const InvoiceCounter = require("../models/InvoiceCounter");
const SystemSettings = require("../models/SystemSettings");
const { createOrder } = require("../services/orderService");
const { getRetailBusinessReports } = require("../services/reportingService");

const buildMongoUri = () => {
  if (process.env.MONGO_TEST_URI) {
    return process.env.MONGO_TEST_URI;
  }

  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return `mongodb://127.0.0.1:27017/basketiq_reporting_gst_${suffix}`;
};

test("GST business report aggregates per-item slabs, supports IGST splits, and reads legacy item gstRate fields", async (t) => {
  const mongoUri = buildMongoUri();

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });
  } catch (error) {
    t.skip(`MongoDB is unavailable for GST report tests: ${error.message}`);
    return;
  }

  try {
    await Promise.all([
      Product.init(),
      Order.init(),
      Customer.init(),
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

    const [productFive, productTwelve, productEighteen] = await Product.create([
      {
        name: "GST 5 Product",
        sku: "GST-5-01",
        category: "Groceries",
        unitType: "unit",
        sellingPrice: 100,
        price: 100,
        costPrice: 60,
        gstRate: 5,
        taxType: "exclusive",
        stock: 50,
        reorderPoint: 5,
      },
      {
        name: "GST 12 Legacy Product",
        sku: "GST-12-01",
        category: "Packaged Food",
        unitType: "unit",
        sellingPrice: 150,
        price: 150,
        costPrice: 90,
        gstRate: 12,
        taxType: "exclusive",
        stock: 40,
        reorderPoint: 5,
      },
      {
        name: "GST 18 Product",
        sku: "GST-18-01",
        category: "Electronics",
        unitType: "unit",
        sellingPrice: 100,
        price: 100,
        costPrice: 70,
        gstRate: 18,
        taxType: "exclusive",
        stock: 60,
        reorderPoint: 5,
      },
    ]);

    const customer = await Customer.create({
      name: "GST Test Customer",
      phone: "9999999999",
      customerType: "regular",
    });

    const intraOrder = await createOrder({
      customerId: String(customer._id),
      paymentMethod: "cash",
      items: [
        {
          productId: String(productFive._id),
          quantity: 2,
          discountType: "flat",
          discountValue: 0,
        },
        {
          productId: String(productEighteen._id),
          quantity: 1,
          discountType: "flat",
          discountValue: 0,
        },
      ],
    });

    const interOrder = await createOrder({
      paymentMethod: "upi",
      supplyType: "inter",
      placeOfSupply: "24",
      items: [
        {
          productId: String(productEighteen._id),
          quantity: 2,
          discountType: "flat",
          discountValue: 0,
        },
      ],
    });

    await Order.collection.insertOne({
      customerId: null,
      customerName: "Legacy GST Customer",
      paymentMethod: "cash",
      status: "completed",
      invoiceNumber: "INV-LEGACY-01",
      totalAmount: 150,
      taxableAmount: 150,
      gstRate: 12,
      gstAmount: 12,
      cgstAmount: 6,
      sgstAmount: 6,
      igstAmount: 0,
      finalAmount: 162,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          productId: productTwelve._id,
          name: "GST 12 Legacy Product",
          sku: "GST-12-01",
          quantity: 1,
          price: 150,
          lineTotal: 150,
          discountAmount: 0,
          cartDiscountAmount: 0,
          totalDiscountAmount: 0,
          gstRate: 12,
          taxableAmount: 150,
          taxAmount: 12,
          cgstAmount: 6,
          sgstAmount: 6,
          igstAmount: 0,
          finalLineTotal: 150,
        },
      ],
    });

    const report = await getRetailBusinessReports({ datePreset: "last30" });
    const gstBuckets = report.gstReport.rates.reduce((acc, bucket) => {
      acc[String(bucket.rate)] = bucket;
      return acc;
    }, {});

    assert.equal(gstBuckets["0"].rows.length, 0);

    assert.equal(gstBuckets["5"].summary.totalRows, 1);
    assert.equal(gstBuckets["5"].summary.totalTaxableValue, 200);
    assert.equal(gstBuckets["5"].summary.totalGstCollected, 10);
    assert.equal(gstBuckets["5"].summary.totalCgst, 5);
    assert.equal(gstBuckets["5"].summary.totalSgst, 5);
    assert.equal(gstBuckets["5"].summary.totalIgst, 0);
    assert.equal(gstBuckets["5"].summary.totalInvoiceValue, 210);

    assert.equal(gstBuckets["12"].summary.totalRows, 1);
    assert.equal(gstBuckets["12"].summary.totalTaxableValue, 150);
    assert.equal(gstBuckets["12"].summary.totalGstCollected, 12);
    assert.equal(gstBuckets["12"].summary.totalInvoiceValue, 162);
    assert.equal(gstBuckets["12"].rows[0].gstRate, 12);
    assert.equal(gstBuckets["12"].rows[0].total, 162);

    assert.equal(gstBuckets["18"].summary.totalRows, 2);
    assert.equal(gstBuckets["18"].summary.totalTaxableValue, 300);
    assert.equal(gstBuckets["18"].summary.totalGstCollected, 54);
    assert.equal(gstBuckets["18"].summary.totalCgst, 9);
    assert.equal(gstBuckets["18"].summary.totalSgst, 9);
    assert.equal(gstBuckets["18"].summary.totalIgst, 36);
    assert.equal(gstBuckets["18"].summary.totalInvoiceValue, 354);

    const intra18Row = gstBuckets["18"].rows.find((row) => row.invoiceId === intraOrder.invoiceNumber);
    const inter18Row = gstBuckets["18"].rows.find((row) => row.invoiceId === interOrder.invoiceNumber);

    assert.ok(intra18Row);
    assert.equal(intra18Row.taxableValue, 100);
    assert.equal(intra18Row.cgst, 9);
    assert.equal(intra18Row.sgst, 9);
    assert.equal(intra18Row.igst, 0);
    assert.equal(intra18Row.total, 118);

    assert.ok(inter18Row);
    assert.equal(inter18Row.taxableValue, 200);
    assert.equal(inter18Row.cgst, 0);
    assert.equal(inter18Row.sgst, 0);
    assert.equal(inter18Row.igst, 36);
    assert.equal(inter18Row.total, 236);

    assert.equal(report.gstReport.summary.totalTaxableValue, 650);
    assert.equal(report.gstReport.summary.totalGstCollected, 76);
    assert.equal(report.gstReport.summary.totalCgst, 20);
    assert.equal(report.gstReport.summary.totalSgst, 20);
    assert.equal(report.gstReport.summary.totalIgst, 36);
    assert.equal(report.gstReport.summary.totalInvoiceValue, 726);
  } finally {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
