const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("../config/db");
const User = require("../models/User");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const StockLedger = require("../models/StockLedger");
const Notification = require("../models/Notification");
const InvoiceCounter = require("../models/InvoiceCounter");
const SystemSettings = require("../models/SystemSettings");
const productService = require("../services/productService");
const customerService = require("../services/customerService");
const inventoryService = require("../services/inventoryService");
const posService = require("../services/posService");
const settingsService = require("../services/settingsService");
const notificationService = require("../services/notificationService");

dotenv.config({ path: require("path").resolve(__dirname, "..", ".env"), quiet: true });

const DAY = 24 * 60 * 60 * 1000;

const PRODUCT_BLUEPRINTS = [
  {
    name: "Royal Basmati Rice 5kg",
    sku: "GRC-RICE-5KG",
    category: "Grocery",
    brand: "Royal Harvest",
    unitType: "pack",
    costPrice: 420,
    sellingPrice: 499,
    gstRate: 5,
    taxType: "exclusive",
    hsnCode: "100630",
    minStock: 12,
    maxStock: 120,
    reorderPoint: 18,
  },
  {
    name: "Sunfresh Sunflower Oil 1L",
    sku: "GRC-OIL-1L",
    category: "Grocery",
    brand: "Sunfresh",
    unitType: "bottle",
    costPrice: 128,
    sellingPrice: 149,
    gstRate: 5,
    taxType: "exclusive",
    hsnCode: "151219",
    minStock: 15,
    maxStock: 150,
    reorderPoint: 20,
  },
  {
    name: "Daily Bake Whole Wheat Bread",
    sku: "BRD-WHEAT-400G",
    category: "Bakery",
    brand: "Daily Bake",
    unitType: "loaf",
    costPrice: 28,
    sellingPrice: 35,
    gstRate: 0,
    taxType: "exempt",
    hsnCode: "190590",
    minStock: 6,
    maxStock: 60,
    reorderPoint: 12,
  },
  {
    name: "Farm Fresh Cow Milk 1L",
    sku: "DRY-MILK-1L",
    category: "Dairy",
    brand: "Farm Fresh",
    unitType: "packet",
    costPrice: 44,
    sellingPrice: 52,
    gstRate: 0,
    taxType: "exempt",
    hsnCode: "040120",
    minStock: 10,
    maxStock: 80,
    reorderPoint: 15,
  },
  {
    name: "Crunchy Potato Chips 150g",
    sku: "SNK-CHIPS-150G",
    category: "Snacks",
    brand: "Crunchy",
    unitType: "pack",
    costPrice: 24,
    sellingPrice: 35,
    gstRate: 12,
    taxType: "exclusive",
    hsnCode: "190590",
    minStock: 8,
    maxStock: 100,
    reorderPoint: 10,
  },
  {
    name: "GlowCare Bath Soap Pack of 4",
    sku: "HPC-SOAP-4PK",
    category: "Personal Care",
    brand: "GlowCare",
    unitType: "pack",
    costPrice: 92,
    sellingPrice: 129,
    gstRate: 18,
    taxType: "exclusive",
    hsnCode: "340111",
    minStock: 10,
    maxStock: 70,
    reorderPoint: 14,
  },
  {
    name: "Sparkle Floor Cleaner 2L",
    sku: "HMC-FLOOR-2L",
    category: "Home Care",
    brand: "Sparkle",
    unitType: "bottle",
    costPrice: 150,
    sellingPrice: 219,
    gstRate: 18,
    taxType: "exclusive",
    hsnCode: "340220",
    minStock: 8,
    maxStock: 50,
    reorderPoint: 12,
  },
  {
    name: "Pulse Bluetooth Neckband",
    sku: "ELC-NECK-01",
    category: "Electronics",
    brand: "Pulse",
    unitType: "piece",
    costPrice: 850,
    sellingPrice: 1299,
    gstRate: 18,
    taxType: "exclusive",
    hsnCode: "851830",
    minStock: 3,
    maxStock: 30,
    reorderPoint: 6,
  },
  {
    name: "Premium Chocolate Gift Box",
    sku: "CNF-CHOCO-BOX",
    category: "Confectionery",
    brand: "Cocoa Bliss",
    unitType: "box",
    costPrice: 180,
    sellingPrice: 299,
    gstRate: 28,
    taxType: "exclusive",
    hsnCode: "180690",
    minStock: 6,
    maxStock: 40,
    reorderPoint: 8,
  },
  {
    name: "Volt Energy Drink Pack",
    sku: "BEV-ENERGY-4PK",
    category: "Beverages",
    brand: "Volt",
    unitType: "pack",
    costPrice: 70,
    sellingPrice: 120,
    gstRate: 28,
    taxType: "exclusive",
    hsnCode: "220299",
    minStock: 6,
    maxStock: 60,
    reorderPoint: 9,
  },
  {
    name: "SteelMate Water Bottle 1L",
    sku: "KTN-BOTTLE-1L",
    category: "Kitchenware",
    brand: "SteelMate",
    unitType: "piece",
    costPrice: 190,
    sellingPrice: 299,
    gstRate: 12,
    taxType: "exclusive",
    hsnCode: "732393",
    minStock: 5,
    maxStock: 40,
    reorderPoint: 7,
  },
];

const CUSTOMER_BLUEPRINTS = [
  {
    key: "defaultWalkIn",
    name: "Counter Walk-in Customer",
    phone: "9876500001",
    customerType: "walk_in",
    address: "Front Desk, BasketIQ Demo Store, Pune, Maharashtra",
  },
  {
    key: "eventWalkIn",
    name: "Walk-in Festival Shopper",
    phone: "9876500002",
    customerType: "walk_in",
    address: "Guest Counter, BasketIQ Demo Store, Pune, Maharashtra",
  },
  {
    key: "priya",
    name: "Priya Sharma",
    phone: "9876500011",
    customerType: "regular",
    email: "priya.sharma@example.com",
    address: "Flat 304, Lotus Residency, Pune, Maharashtra",
  },
  {
    key: "rohan",
    name: "Rohan Mehta",
    phone: "9876500012",
    customerType: "regular",
    email: "rohan.mehta@example.com",
    address: "B-18, Silver Heights, Pune, Maharashtra",
  },
  {
    key: "anita",
    name: "Anita Verma",
    phone: "9876500013",
    customerType: "regular",
    email: "anita.verma@example.com",
    address: "22 Sunrise Park, Pune, Maharashtra",
  },
  {
    key: "greenleaf",
    name: "Greenleaf Apartments Association",
    phone: "9876500021",
    customerType: "business",
    email: "accounts@greenleaf.example.com",
    address: "88 Riverside Avenue, Pune, Maharashtra",
    gstin: "27AAACG1234A1Z5",
  },
  {
    key: "technova",
    name: "TechNova Solutions Pvt Ltd",
    phone: "9876500022",
    customerType: "business",
    email: "finance@technova.example.com",
    address: "14 IT Park Road, Bengaluru, Karnataka",
    gstin: "29AAACT2345L1Z2",
  },
  {
    key: "citycare",
    name: "City Care Pharmacy",
    phone: "9876500023",
    customerType: "business",
    email: "billing@citycare.example.com",
    address: "55 Central Square, Pune, Maharashtra",
    gstin: "27AABCC3456D1Z8",
  },
];

const OPENING_STOCK = {
  "GRC-RICE-5KG": 60,
  "GRC-OIL-1L": 70,
  "BRD-WHEAT-400G": 18,
  "DRY-MILK-1L": 40,
  "SNK-CHIPS-150G": 50,
  "HPC-SOAP-4PK": 35,
  "HMC-FLOOR-2L": 25,
  "ELC-NECK-01": 8,
  "CNF-CHOCO-BOX": 20,
  "BEV-ENERGY-4PK": 18,
  "KTN-BOTTLE-1L": 16,
};

const INVENTORY_EVENTS = [
  {
    sku: "GRC-OIL-1L",
    movementType: "STOCK_IN",
    quantityChange: 20,
    daysAgo: 13,
    reason: "Weekly distributor refill",
    note: "High-demand grocery top-up before weekend rush.",
  },
  {
    sku: "DRY-MILK-1L",
    movementType: "STOCK_IN",
    quantityChange: 8,
    daysAgo: 9,
    reason: "Cold-chain replenishment",
    note: "Fresh dairy batch received for recurring morning demand.",
  },
  {
    sku: "ELC-NECK-01",
    movementType: "STOCK_IN",
    quantityChange: 3,
    daysAgo: 7,
    reason: "Accessory restock",
    note: "Fast-moving electronics item replenished for weekend sales.",
  },
  {
    sku: "BRD-WHEAT-400G",
    movementType: "STOCK_OUT",
    quantityChange: -3,
    daysAgo: 3,
    reason: "Damaged stock write-off",
    note: "Bread loaves removed after packaging damage.",
  },
  {
    sku: "HPC-SOAP-4PK",
    movementType: "ADJUSTMENT",
    quantityChange: -6,
    daysAgo: 2,
    reason: "Cycle count correction",
    note: "Inventory audit corrected packed soap count.",
  },
];

const ORDER_BLUEPRINTS = [
  {
    daysAgo: 18,
    paymentMethod: "cash",
    items: [
      { sku: "GRC-RICE-5KG", quantity: 1 },
      { sku: "GRC-OIL-1L", quantity: 2 },
      { sku: "BRD-WHEAT-400G", quantity: 2 },
    ],
  },
  {
    daysAgo: 17,
    customerKey: "priya",
    paymentMethod: "upi",
    items: [
      { sku: "DRY-MILK-1L", quantity: 2 },
      { sku: "SNK-CHIPS-150G", quantity: 3 },
    ],
  },
  {
    daysAgo: 15,
    customerKey: "greenleaf",
    paymentMethod: "card",
    items: [
      { sku: "HMC-FLOOR-2L", quantity: 2 },
      { sku: "HPC-SOAP-4PK", quantity: 2 },
    ],
  },
  {
    daysAgo: 14,
    customerKey: "rohan",
    paymentMethod: "cash",
    items: [{ sku: "ELC-NECK-01", quantity: 1 }],
  },
  {
    daysAgo: 12,
    paymentMethod: "upi",
    items: [
      {
        sku: "CNF-CHOCO-BOX",
        quantity: 2,
        discountType: "percent",
        discountValue: 10,
      },
      { sku: "BEV-ENERGY-4PK", quantity: 4 },
    ],
  },
  {
    daysAgo: 10,
    customerKey: "technova",
    paymentMethod: "card",
    supplyType: "inter",
    placeOfSupply: "29",
    items: [
      { sku: "ELC-NECK-01", quantity: 2 },
      { sku: "KTN-BOTTLE-1L", quantity: 3 },
    ],
  },
  {
    daysAgo: 8,
    customerKey: "anita",
    paymentMethod: "cash",
    cartDiscountType: "flat",
    cartDiscountValue: 20,
    items: [
      { sku: "GRC-RICE-5KG", quantity: 2 },
      { sku: "DRY-MILK-1L", quantity: 2 },
      { sku: "BRD-WHEAT-400G", quantity: 2 },
    ],
  },
  {
    daysAgo: 6,
    paymentMethod: "cash",
    items: [
      { sku: "SNK-CHIPS-150G", quantity: 4 },
      { sku: "HPC-SOAP-4PK", quantity: 1 },
    ],
  },
  {
    daysAgo: 5,
    customerKey: "citycare",
    paymentMethod: "upi",
    items: [
      { sku: "HMC-FLOOR-2L", quantity: 3 },
      { sku: "GRC-OIL-1L", quantity: 6 },
    ],
  },
  {
    daysAgo: 4,
    customerKey: "priya",
    paymentMethod: "card",
    items: [
      { sku: "KTN-BOTTLE-1L", quantity: 2 },
      { sku: "CNF-CHOCO-BOX", quantity: 1 },
    ],
  },
  {
    daysAgo: 2,
    customerKey: "rohan",
    paymentMethod: "upi",
    items: [
      { sku: "BRD-WHEAT-400G", quantity: 6 },
      { sku: "DRY-MILK-1L", quantity: 4 },
      { sku: "BEV-ENERGY-4PK", quantity: 5 },
    ],
  },
  {
    daysAgo: 1,
    paymentMethod: "cash",
    items: [
      { sku: "ELC-NECK-01", quantity: 3 },
      { sku: "SNK-CHIPS-150G", quantity: 2 },
      { sku: "CNF-CHOCO-BOX", quantity: 2 },
    ],
  },
];

const buildPastDate = (daysAgo, hour = 11, minute = 0) =>
  new Date(Date.now() - daysAgo * DAY + hour * 60 * 60 * 1000 + minute * 60 * 1000);

const clearDemoData = async () => {
  await Promise.all([
    Cart.deleteMany({}),
    Notification.deleteMany({}),
    StockLedger.deleteMany({}),
    Order.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    InvoiceCounter.deleteMany({}),
    SystemSettings.deleteMany({}),
  ]);
};

const ensureDemoUser = async ({ name, email, password, role }) => {
  let user = await User.findOne({ email });

  if (!user) {
    user = new User({
      name,
      email,
      password,
      role,
      isActive: true,
    });
  } else {
    user.name = name;
    user.password = password;
    user.role = role;
    user.isActive = true;
  }

  await user.save();
  return user;
};

const createCustomers = async () => {
  const customers = {};

  for (const blueprint of CUSTOMER_BLUEPRINTS) {
    customers[blueprint.key] = await customerService.createCustomer(blueprint);
  }

  return customers;
};

const createProducts = async () => {
  const products = {};

  for (const blueprint of PRODUCT_BLUEPRINTS) {
    const product = await productService.createProduct(blueprint);
    products[blueprint.sku] = product;
  }

  return products;
};

const seedOpeningStock = async (products, actor) => {
  const openingDate = buildPastDate(21, 9, 15);

  for (const [sku, quantity] of Object.entries(OPENING_STOCK)) {
    await inventoryService.recordMovement({
      productId: products[sku]._id,
      movementType: "OPENING_STOCK",
      quantityChange: quantity,
      referenceType: "SYSTEM",
      reason: "Demo opening stock",
      note: "Initial stock imported for demo environment.",
      movementDate: openingDate,
      performedBy: actor,
    });
  }
};

const seedInventoryMovements = async (products, actor) => {
  for (const event of INVENTORY_EVENTS) {
    await inventoryService.recordMovement({
      productId: products[event.sku]._id,
      movementType: event.movementType,
      quantityChange: event.quantityChange,
      referenceType: "MANUAL",
      reason: event.reason,
      note: event.note,
      movementDate: buildPastDate(event.daysAgo, 10, 20),
      performedBy: actor,
    });
  }
};

const backdateOrderArtifacts = async (invoiceNumber, date) => {
  const order = await Order.findOne({ invoiceNumber });

  if (!order) {
    throw new Error(`Unable to backdate order ${invoiceNumber}.`);
  }

  await Order.collection.updateOne(
    { _id: order._id },
    {
      $set: {
        createdAt: date,
        updatedAt: date,
      },
    }
  );

  await StockLedger.collection.updateMany(
    { referenceType: "ORDER", referenceId: invoiceNumber },
    {
      $set: {
        movementDate: date,
        createdAt: date,
        updatedAt: date,
      },
    }
  );
};

const createPosOrders = async ({ products, customers, cartUser, actor }) => {
  const orders = [];

  for (const blueprint of ORDER_BLUEPRINTS) {
    await posService.clearCart(cartUser._id);

    for (const item of blueprint.items) {
      await posService.addItemToCart(cartUser._id, {
        productId: products[item.sku]._id,
        quantity: item.quantity,
        discountType: item.discountType,
        discountValue: item.discountValue,
      });
    }

    if (blueprint.cartDiscountType || blueprint.cartDiscountValue) {
      await posService.setCartDiscount(cartUser._id, {
        cartDiscountType: blueprint.cartDiscountType || "flat",
        cartDiscountValue: blueprint.cartDiscountValue || 0,
      });
    }

    const order = await posService.checkoutCart(
      cartUser._id,
      {
        customerId: blueprint.customerKey ? customers[blueprint.customerKey]._id : undefined,
        paymentMethod: blueprint.paymentMethod,
        supplyType: blueprint.supplyType,
        placeOfSupply: blueprint.placeOfSupply,
      },
      actor
    );

    const orderDate = buildPastDate(blueprint.daysAgo, 12, 10);
    await backdateOrderArtifacts(order.invoiceNumber, orderDate);
    orders.push({
      ...order,
      createdAt: orderDate,
    });
  }

  await posService.clearCart(cartUser._id);
  return orders;
};

const refreshNamedCustomerStats = async (customers) => {
  const keys = Object.keys(customers).filter(
    (key) => !["defaultWalkIn", "eventWalkIn"].includes(key)
  );

  for (const key of keys) {
    await customerService.refreshCustomerStats(customers[key]._id);
  }
};

const buildSummary = async (customers, orders) => {
  const lowStockProducts = await inventoryService.getLowStock();
  const paymentMix = orders.reduce((acc, order) => {
    const method = order.paymentMethod || "cash";
    acc[method] = (acc[method] || 0) + 1;
    return acc;
  }, {});

  return {
    products: await Product.countDocuments(),
    customers: await Customer.countDocuments(),
    orders: await Order.countDocuments(),
    stockMovements: await StockLedger.countDocuments(),
    lowStockProducts: lowStockProducts.map((product) => ({
      name: product.name,
      stock: product.stock,
      reorderPoint: product.reorderPoint,
      stockStatus: product.stockStatus,
    })),
    paymentMix,
    defaultWalkInCustomer: customers.defaultWalkIn.name,
  };
};

const main = async () => {
  await connectDB();

  try {
    console.log("Resetting core demo collections...");
    await clearDemoData();

    console.log("Ensuring demo users...");
    const demoAdmin = await ensureDemoUser({
      name: "BasketIQ Demo Admin",
      email: "demo.admin@basketiq.local",
      password: "Demo@123",
      role: "admin",
    });
    const demoStaff = await ensureDemoUser({
      name: "BasketIQ Demo Staff",
      email: "demo.staff@basketiq.local",
      password: "Demo@123",
      role: "staff",
    });

    const actor = {
      userId: demoStaff._id,
      name: demoStaff.name,
      role: demoStaff.role,
    };

    console.log("Creating customers...");
    const customers = await createCustomers();

    console.log("Saving business and POS settings...");
    await settingsService.updateSettings({
      business: {
        storeName: "BasketIQ Smart Retail Demo Store",
        gstin: "27ABCDE1234F1Z5",
        address: "21 Market Square, Pune, Maharashtra",
        phone: "+91 9876500099",
      },
      billing: {
        defaultGstRate: 5,
        currency: "₹",
      },
      pos: {
        allowNegativeStock: false,
        defaultWalkInCustomerId: customers.defaultWalkIn._id,
      },
    });

    console.log("Creating products...");
    const products = await createProducts();

    console.log("Recording opening stock...");
    await seedOpeningStock(products, actor);

    console.log("Recording manual inventory movements...");
    await seedInventoryMovements(products, actor);

    console.log("Creating POS orders...");
    const orders = await createPosOrders({
      products,
      customers,
      cartUser: demoStaff,
      actor,
    });

    console.log("Refreshing customer analytics...");
    await refreshNamedCustomerStats(customers);

    console.log("Syncing demo notifications...");
    await notificationService.getNotifications(demoAdmin._id);

    const summary = await buildSummary(customers, orders);

    console.log("");
    console.log("Demo seed completed successfully.");
    console.log("--------------------------------");
    console.log(`Products seeded: ${summary.products}`);
    console.log(`Customers seeded: ${summary.customers}`);
    console.log(`Orders seeded: ${summary.orders}`);
    console.log(`Stock movements seeded: ${summary.stockMovements}`);
    console.log(`Default walk-in customer: ${summary.defaultWalkInCustomer}`);
    console.log(`Payment mix: ${JSON.stringify(summary.paymentMix)}`);
    console.log("Low stock highlights:");
    summary.lowStockProducts.forEach((product) => {
      console.log(
        `- ${product.name}: ${product.stock} units (${product.stockStatus}, threshold ${product.reorderPoint})`
      );
    });
    console.log("");
    console.log("Demo login credentials:");
    console.log("- Admin: demo.admin@basketiq.local / Demo@123");
    console.log("- Staff: demo.staff@basketiq.local / Demo@123");
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Demo seed failed:", error);
  mongoose.disconnect().finally(() => process.exit(1));
});
