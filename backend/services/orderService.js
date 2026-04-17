const mongoose = require("mongoose");
const Order = require("../models/Order");
const InvoiceCounter = require("../models/InvoiceCounter");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const { runInTransaction } = require("./transactionService");
const inventoryService = require("./inventoryService");
const customerService = require("./customerService");
const settingsService = require("./settingsService");
const {
  normalizeSupplyType,
  normalizeTaxRate,
  normalizeHsnCode,
  calculateTaxFromAmount,
  buildTaxBreakdown,
  roundCurrency,
} = require("./gstService");

const PAYMENT_METHODS = ["cash", "upi", "card", "split"];
const DISCOUNT_TYPES = ["flat", "percent"];
const ORDER_STATUSES = ["completed", "cancelled", "refunded"];
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const STATE_CODE_REGEX = /^[0-9]{2}$/;
const MAX_INVOICE_NUMBER_LENGTH = 16;
const INVOICE_MIN_DIGITS = 3;
const MAX_INVOICE_GENERATION_ATTEMPTS = 3;
const MAX_COUNTER_UPDATE_ATTEMPTS = 3;

const roundNonNegative = (value) => roundCurrency(Math.max(0, Number(value) || 0));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getProductStock = (product) => toNumber(product?.stock, 0);
const getProductSellingPrice = (product) =>
  roundCurrency(toNumber(product?.sellingPrice ?? product?.price, 0));

const isValidOrderStatus = (status) => ORDER_STATUSES.includes(status);

const normalizeText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const normalizeGstin = (value) => String(value || "").trim().toUpperCase();

const normalizeStateCode = (value) => {
  const digits = String(value || "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 2);

  return STATE_CODE_REGEX.test(digits) ? digits : "";
};

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatInvoiceSequence = (sequence) =>
  String(sequence).padStart(Math.max(INVOICE_MIN_DIGITS, String(sequence).length), "0");

const buildInvoiceNumber = (year, sequence) => `INV-${year}-${formatInvoiceSequence(sequence)}`;

const getInvoiceSequenceFromValue = (invoiceNumber, year) => {
  const match = new RegExp(`^INV-${year}-(\\d+)$`).exec(String(invoiceNumber || "").trim());

  if (!match) {
    return 0;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const inferStateCodeFromGstin = (gstin) => {
  const normalizedGstin = normalizeGstin(gstin);
  return GSTIN_REGEX.test(normalizedGstin) ? normalizedGstin.slice(0, 2) : "";
};

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const normalizeDiscountType = (value) => {
  const parsed = String(value || "flat").toLowerCase();
  return DISCOUNT_TYPES.includes(parsed) ? parsed : "flat";
};

const normalizeDiscountValue = (value) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return roundCurrency(parsed);
};

const calculateDiscount = ({ amount, type, value }) => {
  const normalizedAmount = roundNonNegative(amount);
  const normalizedType = normalizeDiscountType(type);
  const normalizedValue = normalizeDiscountValue(value);

  if (normalizedAmount <= 0 || normalizedValue <= 0) {
    return {
      type: normalizedType,
      value: normalizedValue,
      amount: 0,
    };
  }

  if (normalizedType === "percent") {
    const safePercent = Math.min(normalizedValue, 100);
    return {
      type: normalizedType,
      value: safePercent,
      amount: roundCurrency(normalizedAmount * (safePercent / 100)),
    };
  }

  return {
    type: normalizedType,
    value: normalizedValue,
    amount: Math.min(normalizedValue, normalizedAmount),
  };
};

const allocateCartDiscountAmounts = (lineAmounts, totalCartDiscount) => {
  const allocations = lineAmounts.map(() => 0);
  const normalizedTotalDiscount = roundCurrency(totalCartDiscount);
  const grossBase = roundCurrency(lineAmounts.reduce((sum, amount) => sum + amount, 0));

  if (normalizedTotalDiscount <= 0 || grossBase <= 0) {
    return allocations;
  }

  let remainingDiscount = normalizedTotalDiscount;
  let remainingBase = grossBase;

  for (let index = 0; index < lineAmounts.length; index += 1) {
    const lineAmount = roundCurrency(lineAmounts[index]);

    if (lineAmount <= 0) {
      allocations[index] = 0;
      continue;
    }

    let allocation;

    if (index === lineAmounts.length - 1 || remainingBase <= 0) {
      allocation = roundCurrency(Math.min(lineAmount, remainingDiscount));
    } else {
      allocation = roundCurrency((remainingDiscount * lineAmount) / remainingBase);
      allocation = roundCurrency(Math.min(allocation, lineAmount));
    }

    allocations[index] = allocation;
    remainingDiscount = roundCurrency(Math.max(0, remainingDiscount - allocation));
    remainingBase = roundCurrency(Math.max(0, remainingBase - lineAmount));
  }

  return allocations;
};

const normalizePartyDetails = (details = {}, { fallbackName = "" } = {}) => {
  const gstin = normalizeGstin(details.gstin);
  const stateCode = normalizeStateCode(details.stateCode || inferStateCodeFromGstin(gstin));

  return {
    legalName:
      normalizeText(details.legalName) ||
      normalizeText(details.name) ||
      fallbackName,
    address: normalizeText(details.address),
    gstin,
    stateCode,
    phone: normalizeText(details.phone),
    email: normalizeEmail(details.email),
  };
};

const getSellerDetails = (businessSettings = {}) =>
  normalizePartyDetails(
    {
      legalName:
        businessSettings.storeName || process.env.SHOP_NAME || "BasketIQ Store",
      address: businessSettings.address || process.env.SHOP_ADDRESS || "",
      gstin:
        businessSettings.gstin ||
        process.env.SHOP_GST_NUMBER ||
        "27ABCDE1234F1Z5",
      stateCode: process.env.SHOP_STATE_CODE || "",
      phone: businessSettings.phone || process.env.SHOP_PHONE || "",
      email: process.env.SHOP_EMAIL || "",
    },
    {
      fallbackName:
        businessSettings.storeName || process.env.SHOP_NAME || "BasketIQ Store",
    }
  );

const getBuyerDetails = ({ customer, customerDetails } = {}) =>
  normalizePartyDetails(
    {
      legalName: customer?.name || customerDetails?.name || "",
      address: customer?.address || customerDetails?.address || "",
      gstin: customer?.gstin || customerDetails?.gstin || "",
      stateCode: customer?.stateCode || customerDetails?.stateCode || "",
      phone: customer?.phone || customerDetails?.phone || "",
      email: customer?.email || customerDetails?.email || "",
    },
    { fallbackName: customer?.name || customerDetails?.name || "Walk-in Customer" }
  );

const getMaxExistingInvoiceSequence = async (year, session) => {
  const prefix = `INV-${year}-`;
  const [record] = await Order.aggregate([
    {
      $match: {
        invoiceNumber: {
          $regex: `^${escapeRegex(prefix)}\\d+$`,
        },
      },
    },
    {
      $project: {
        sequence: {
          $convert: {
            input: {
              $arrayElemAt: [{ $split: ["$invoiceNumber", "-"] }, 2],
            },
            to: "int",
            onError: 0,
            onNull: 0,
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        maxSequence: { $max: "$sequence" },
      },
    },
  ]).session(session);

  return toNumber(record?.maxSequence, 0);
};

const isDuplicateCounterDocumentError = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?._id || Object.prototype.hasOwnProperty.call(error?.keyValue || {}, "_id"));

const generateNextInvoiceNumber = async (session, invoiceDate = new Date()) => {
  const year = invoiceDate.getFullYear();
  const counterId = `invoice:${year}`;
  const maxExistingSequence = await getMaxExistingInvoiceSequence(year, session);

  for (let attempt = 1; attempt <= MAX_COUNTER_UPDATE_ATTEMPTS; attempt += 1) {
    try {
      const counterResult = await InvoiceCounter.collection.findOneAndUpdate(
        { _id: counterId },
        [
          {
            $set: {
              year,
              prefix: `INV-${year}-`,
              sequence: {
                $add: [
                  {
                    $max: [{ $ifNull: ["$sequence", 0] }, maxExistingSequence],
                  },
                  1,
                ],
              },
            },
          },
        ],
        {
          upsert: true,
          session: session || undefined,
          returnDocument: "after",
        }
      );

      const counter =
        counterResult && typeof counterResult === "object" && "value" in counterResult
          ? counterResult.value
          : counterResult;
      const sequence = toNumber(counter?.sequence, 0);
      const invoiceNumber = buildInvoiceNumber(year, sequence || 1);

      if (invoiceNumber.length > MAX_INVOICE_NUMBER_LENGTH) {
        throw new ApiError(
          500,
          "Invoice counter exceeded the supported invoice number length.",
          "INVOICE_GENERATION_FAILED"
        );
      }

      return invoiceNumber;
    } catch (error) {
      if (!isDuplicateCounterDocumentError(error) || attempt === MAX_COUNTER_UPDATE_ATTEMPTS) {
        throw error;
      }

      console.warn(`Invoice counter race detected for ${counterId}. Retrying counter increment...`);
    }
  }

  throw new ApiError(
    500,
    "We could not generate the next invoice number safely. Please retry bill generation.",
    "INVOICE_GENERATION_FAILED"
  );
};

const buildOrderSnapshot = (order) => {
  const seller = normalizePartyDetails(order?.sellerDetails, {
    fallbackName: process.env.SHOP_NAME || "BasketIQ Store",
  });
  const buyer = normalizePartyDetails(
    {
      legalName: order?.buyerDetails?.legalName || order?.customerName,
      address: order?.buyerDetails?.address || order?.customerAddress,
      gstin: order?.buyerDetails?.gstin || order?.customerGstin,
      stateCode: order?.buyerDetails?.stateCode || order?.customerStateCode,
      phone: order?.buyerDetails?.phone || order?.customerPhone,
      email: order?.buyerDetails?.email || order?.customerEmail,
    },
    { fallbackName: order?.customerName || "Walk-in Customer" }
  );

  return {
    seller,
    buyer,
  };
};

const buildGstCompliantInvoice = (order) => {
  const { seller, buyer } = buildOrderSnapshot(order);

  return {
    invoiceNumber: order.invoiceNumber,
    invoiceDate: order.createdAt,
    invoiceCategory: order.invoiceCategory || (buyer.gstin ? "b2b" : "b2c"),
    placeOfSupply: order.placeOfSupply || seller.stateCode || "",
    supplyType: order.supplyType || "intra",
    seller,
    buyer,
    items: (order.items || []).map((item) => ({
      description: normalizeText(item?.name, "Item"),
      hsnCode: item.hsnCode || "",
      quantity: item.quantity,
      unit: item.unit || "unit",
      unitPrice: item.price,
      lineTotal: item.lineTotal,
      discountAmount: item.totalDiscountAmount ?? item.discountAmount ?? 0,
      taxableAmount: item.taxableAmount ?? item.finalLineTotal ?? 0,
      taxRate: item.taxRate ?? 0,
      cgstRate: item.cgstRate ?? 0,
      cgstAmount: item.cgstAmount ?? 0,
      sgstRate: item.sgstRate ?? 0,
      sgstAmount: item.sgstAmount ?? 0,
      igstRate: item.igstRate ?? 0,
      igstAmount: item.igstAmount ?? 0,
      taxAmount: item.taxAmount ?? 0,
      lineAmountWithTax: item.lineAmountWithTax ?? item.finalLineTotal ?? 0,
    })),
    totals: {
      subTotal: order.totalAmount ?? 0,
      itemDiscountAmount: order.itemDiscountAmount ?? 0,
      cartDiscountAmount: order.cartDiscountAmount ?? 0,
      totalDiscountAmount: order.discountAmount ?? 0,
      taxableAmount: order.taxableAmount ?? 0,
      cgstAmount: order.cgstAmount ?? 0,
      sgstAmount: order.sgstAmount ?? 0,
      igstAmount: order.igstAmount ?? 0,
      totalTaxAmount: order.gstAmount ?? 0,
      grandTotal: order.finalAmount ?? 0,
    },
    taxBreakdown: order.taxBreakdown || [],
    payment: {
      method: order.paymentMethod || "cash",
      splitPayment: order.splitPayment || { cashAmount: 0, upiAmount: 0 },
    },
  };
};

const isDuplicateInvoiceNumberError = (error) =>
  error?.code === 11000 &&
  (error?.keyPattern?.invoiceNumber || Object.prototype.hasOwnProperty.call(error?.keyValue || {}, "invoiceNumber"));

const resolveInvoiceStatus = (order) => {
  const normalizedStatus = String(order?.status || "completed").toLowerCase();
  if (!order?.invoiceNumber) {
    return "pending";
  }

  if (normalizedStatus === "cancelled") {
    return "voided";
  }

  if (normalizedStatus === "refunded") {
    return "refunded";
  }

  return "issued";
};

const resolvePaymentStatus = (order) => {
  const normalizedStatus = String(order?.status || "completed").toLowerCase();

  if (normalizedStatus === "refunded") {
    return "refunded";
  }

  if (normalizedStatus === "cancelled") {
    return "voided";
  }

  return "paid";
};

const serializeOrder = (order) => {
  if (!order) {
    return null;
  }

  const normalizedOrder =
    typeof order.toObject === "function" ? order.toObject() : { ...order };
  const status = String(normalizedOrder.status || "completed").toLowerCase();

  return {
    ...normalizedOrder,
    status,
    invoiceStatus: resolveInvoiceStatus(normalizedOrder),
    paymentStatus: resolvePaymentStatus(normalizedOrder),
    orderReference:
      normalizedOrder.invoiceNumber ||
      `ORD-${String(normalizedOrder._id || "").slice(-8).toUpperCase()}`,
  };
};

const createOrder = async (payload = {}) => {
  const {
    items,
    customerId,
    customerDetails,
    paymentMethod,
    cartDiscountType,
    cartDiscountValue,
    splitPayment,
    supplyType,
    isInterState,
    placeOfSupply,
    performedBy,
  } = payload;
  const [posSettings, systemSettings] = await Promise.all([
    settingsService.getPosRuntimeSettings(),
    settingsService.getSettings({ includeWalkInCustomer: false }),
  ]);
  const insufficientStockMode = posSettings.insufficientStockMode;
  const allowInsufficientStock = insufficientStockMode === "warn";
  const defaultGstRate = Number(systemSettings?.billing?.defaultGstRate ?? 5);

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "Order must include at least one item.", "VALIDATION_ERROR");
  }

  const normalizedCustomerId = String(customerId || "");
  if (normalizedCustomerId) {
    validateObjectId(normalizedCustomerId, "customer");
  }

  const normalizedPaymentMethod = String(paymentMethod || "cash").toLowerCase();
  if (!PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
    throw new ApiError(
      400,
      "Payment method must be one of: cash, upi, card, split.",
      "VALIDATION_ERROR"
    );
  }

  const normalizedSupplyType = normalizeSupplyType(
    supplyType !== undefined ? supplyType : isInterState
  );

  const itemQuantityMap = new Map();
  const normalizedItems = [];

  for (const rawItem of items) {
    const productId = String(rawItem?.productId || "");
    const quantity = Number(rawItem?.quantity);
    const discountType = normalizeDiscountType(rawItem?.discountType);
    const discountValue = normalizeDiscountValue(rawItem?.discountValue);

    validateObjectId(productId, "product");

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ApiError(
        400,
        "Each item quantity must be a positive whole number.",
        "VALIDATION_ERROR"
      );
    }

    itemQuantityMap.set(productId, (itemQuantityMap.get(productId) || 0) + quantity);

    normalizedItems.push({
      productId,
      quantity,
      discountType,
      discountValue,
    });
  }

  for (let attempt = 1; attempt <= MAX_INVOICE_GENERATION_ATTEMPTS; attempt += 1) {
    let createdOrder = null;

    try {
      await runInTransaction(async (session) => {
        const customer = normalizedCustomerId
          ? await Customer.findById(normalizedCustomerId).session(session)
          : null;

        if (normalizedCustomerId && !customer) {
          throw new ApiError(404, "Selected customer not found.", "NOT_FOUND");
        }

        if (customer && customer.isActive === false) {
          throw new ApiError(
            400,
            "Selected customer is inactive and cannot be used for billing.",
            "CUSTOMER_INACTIVE"
          );
        }

        const sellerDetails = getSellerDetails(systemSettings.business);
        const buyerDetails = getBuyerDetails({ customer, customerDetails });
        const normalizedPlaceOfSupply =
          normalizeStateCode(placeOfSupply) ||
          (normalizedSupplyType === "inter" ? buyerDetails.stateCode : sellerDetails.stateCode);

        if (normalizedSupplyType === "inter" && !normalizedPlaceOfSupply) {
          throw new ApiError(
            400,
            "Place of supply is required for inter-state GST invoices.",
            "VALIDATION_ERROR"
          );
        }

        const productIds = [...itemQuantityMap.keys()];
        const products = await Product.find({ _id: { $in: productIds } }).session(session);
        const productMap = new Map(products.map((product) => [String(product._id), product]));

        if (products.length !== productIds.length) {
          throw new ApiError(404, "One or more products were not found.", "NOT_FOUND");
        }

        for (const [productId, requestedQuantity] of itemQuantityMap.entries()) {
          const product = productMap.get(productId);
          const productStock = getProductStock(product);

          if ((product.status || "active") !== "active") {
            throw new ApiError(
              400,
              `${product.name} is inactive and cannot be sold.`,
              "PRODUCT_INACTIVE"
            );
          }

          if (productStock < requestedQuantity) {
            if (!allowInsufficientStock) {
              throw new ApiError(
                400,
                `Insufficient stock for ${product.name}. Available: ${productStock}`,
                "INSUFFICIENT_STOCK"
              );
            }
          }
        }

        const lineDrafts = [];
        let subtotal = 0;
        let itemDiscountAmount = 0;

        for (const normalizedItem of normalizedItems) {
          const product = productMap.get(normalizedItem.productId);
          const sellingPrice = getProductSellingPrice(product);
          const hsnCode = normalizeHsnCode(product.hsnCode || product.hsnSacCode);
          const taxType = String(product.taxType || "exclusive").toLowerCase();

          const normalizedTaxRate =
            taxType === "exempt"
              ? 0
              : normalizeTaxRate(product.gstRate, {
                  allowZero: false,
                  fallback: defaultGstRate,
                });

          const lineTotal = roundCurrency(sellingPrice * normalizedItem.quantity);
          const lineDiscount = calculateDiscount({
            amount: lineTotal,
            type: normalizedItem.discountType,
            value: normalizedItem.discountValue,
          });
          const lineAfterItemDiscount = roundCurrency(lineTotal - lineDiscount.amount);

          lineDrafts.push({
            productId: product._id,
            name: product.name,
            sku: product.sku || "",
            hsnCode,
            unit: normalizeText(product.unitType, "unit"),
            quantity: normalizedItem.quantity,
            price: sellingPrice,
            lineTotal,
            discountType: lineDiscount.type,
            discountValue: lineDiscount.value,
            itemDiscountAmount: lineDiscount.amount,
            lineAfterItemDiscount,
            taxType,
            taxRate: normalizedTaxRate,
          });

          subtotal += lineTotal;
          itemDiscountAmount += lineDiscount.amount;
        }

        subtotal = roundCurrency(subtotal);
        itemDiscountAmount = roundCurrency(itemDiscountAmount);

        const subtotalAfterItemDiscount = roundCurrency(subtotal - itemDiscountAmount);
        const normalizedCartDiscount = calculateDiscount({
          amount: subtotalAfterItemDiscount,
          type: cartDiscountType,
          value: cartDiscountValue,
        });

        const cartDiscountAllocations = allocateCartDiscountAmounts(
          lineDrafts.map((line) => line.lineAfterItemDiscount),
          normalizedCartDiscount.amount
        );

        const orderItems = [];
        let taxableAmount = 0;
        let gstAmount = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        let finalAmount = 0;

        for (let index = 0; index < lineDrafts.length; index += 1) {
          const line = lineDrafts[index];
          const cartDiscountAmount = roundCurrency(cartDiscountAllocations[index] || 0);
          const postCartAmount = roundCurrency(line.lineAfterItemDiscount - cartDiscountAmount);
          const tax = calculateTaxFromAmount({
            amount: postCartAmount,
            taxRate: line.taxRate,
            supplyType: normalizedSupplyType,
            taxType: line.taxType,
          });

          const totalDiscountAmount = roundCurrency(line.itemDiscountAmount + cartDiscountAmount);

          orderItems.push({
            productId: line.productId,
            name: line.name,
            sku: line.sku,
            hsnCode: line.hsnCode,
            unit: line.unit,
            quantity: line.quantity,
            price: line.price,
            costPrice: 0,
            lineTotal: line.lineTotal,
            discountType: line.discountType,
            discountValue: line.discountValue,
            discountAmount: line.itemDiscountAmount,
            cartDiscountAmount,
            totalDiscountAmount,
            taxType: line.taxType,
            taxRate: tax.taxRate,
            taxableAmount: tax.taxableAmount,
            taxAmount: tax.taxAmount,
            cgstRate: tax.cgstRate,
            cgstAmount: tax.cgstAmount,
            sgstRate: tax.sgstRate,
            sgstAmount: tax.sgstAmount,
            igstRate: tax.igstRate,
            igstAmount: tax.igstAmount,
            finalLineTotal: tax.taxableAmount,
            lineAmountWithTax: tax.amountWithTax,
            profitAmount: 0,
          });

          taxableAmount += tax.taxableAmount;
          gstAmount += tax.taxAmount;
          cgstAmount += tax.cgstAmount;
          sgstAmount += tax.sgstAmount;
          igstAmount += tax.igstAmount;
          finalAmount += tax.amountWithTax;
        }

        taxableAmount = roundCurrency(taxableAmount);
        gstAmount = roundCurrency(gstAmount);
        cgstAmount = roundCurrency(cgstAmount);
        sgstAmount = roundCurrency(sgstAmount);
        igstAmount = roundCurrency(igstAmount);
        finalAmount = roundCurrency(finalAmount);

        const totalDiscountAmount = roundCurrency(
          itemDiscountAmount + normalizedCartDiscount.amount
        );
        const effectiveGstRate =
          taxableAmount > 0 ? roundCurrency((gstAmount * 100) / taxableAmount) : 0;
        const taxBreakdown = buildTaxBreakdown(orderItems);

        const normalizedSplitPayment = {
          cashAmount: roundNonNegative(Number(splitPayment?.cashAmount ?? 0)),
          upiAmount: roundNonNegative(Number(splitPayment?.upiAmount ?? 0)),
        };

        if (normalizedPaymentMethod === "split") {
          const splitTotal = roundCurrency(
            normalizedSplitPayment.cashAmount + normalizedSplitPayment.upiAmount
          );
          const splitDiff = Math.abs(splitTotal - finalAmount);

          if (splitTotal <= 0) {
            throw new ApiError(
              400,
              "For split payment, enter cash and/or UPI amount.",
              "VALIDATION_ERROR"
            );
          }

          if (splitDiff > 0.05) {
            throw new ApiError(
              400,
              `Split payment total (${splitTotal.toFixed(2)}) must equal final amount (${finalAmount.toFixed(2)}).`,
              "VALIDATION_ERROR"
            );
          }
        }

        const invoiceNumber = await generateNextInvoiceNumber(session, new Date());
        const initialCostAmount = 0;
        const initialProfitAmount = roundCurrency(taxableAmount - initialCostAmount);
        const invoiceCategory = buyerDetails.gstin ? "b2b" : "b2c";

        const createdDocs = await Order.create(
          [
            {
              customerId: customer?._id || null,
              customerName: buyerDetails.legalName || "Walk-in Customer",
              customerPhone: buyerDetails.phone,
              customerEmail: buyerDetails.email,
              customerAddress: buyerDetails.address,
              customerGstin: buyerDetails.gstin,
              customerStateCode: buyerDetails.stateCode,
              invoiceCategory,
              sellerDetails,
              buyerDetails,
              items: orderItems,
              totalAmount: subtotal,
              taxableAmount,
              costAmount: initialCostAmount,
              profitAmount: initialProfitAmount,
              gstRate: effectiveGstRate,
              gstAmount,
              cgstAmount,
              sgstAmount,
              igstAmount,
              supplyType: normalizedSupplyType,
              placeOfSupply: normalizedPlaceOfSupply || "",
              taxBreakdown,
              itemDiscountAmount,
              cartDiscountType: normalizedCartDiscount.type,
              cartDiscountValue: normalizedCartDiscount.value,
              cartDiscountAmount: normalizedCartDiscount.amount,
              discountAmount: totalDiscountAmount,
              finalAmount,
              paymentMethod: normalizedPaymentMethod,
              splitPayment: normalizedSplitPayment,
              status: "completed",
              invoiceNumber,
            },
          ],
          { session }
        );

        const orderDoc = createdDocs[0];
        let costAmount = 0;

        for (const orderItem of orderItems) {
          const sale = await inventoryService.recordSale({
            productId: String(orderItem.productId),
            quantity: toNumber(orderItem.quantity, 0),
            referenceType: "ORDER",
            referenceId: orderDoc.invoiceNumber,
            reason: allowInsufficientStock ? "Sale completed with stock warning" : "Sale completed",
            note: allowInsufficientStock
              ? `Invoice ${orderDoc.invoiceNumber} processed in warn stock mode`
              : `Invoice ${orderDoc.invoiceNumber}`,
            movementDate: new Date(),
            metadata: {
              orderId: orderDoc._id,
              insufficientStockMode,
            },
            performedBy,
            session,
            allowNegativeStock: allowInsufficientStock,
          });

          orderItem.costPrice = sale.unitCost;
          orderItem.profitAmount = roundCurrency(
            toNumber(orderItem.taxableAmount, 0) - sale.totalCost
          );
          costAmount += sale.totalCost;
        }

        costAmount = roundCurrency(costAmount);
        const profitAmount = roundCurrency(taxableAmount - costAmount);

        orderDoc.items = orderItems;
        orderDoc.costAmount = costAmount;
        orderDoc.profitAmount = profitAmount;
        await orderDoc.save({ session });

        if (customer?._id) {
          await customerService.refreshCustomerStats(String(customer._id), { session });
        }

        createdOrder = orderDoc;
      });

      return serializeOrder(createdOrder);
    } catch (error) {
      if (!isDuplicateInvoiceNumberError(error)) {
        throw error;
      }

      if (attempt === MAX_INVOICE_GENERATION_ATTEMPTS) {
        throw new ApiError(
          409,
          "We could not finalize the bill number safely. Please retry bill generation.",
          "INVOICE_CONFLICT"
        );
      }

      console.warn(
        `Invoice number collision detected during billing attempt ${attempt}. Retrying...`
      );
    }
  }

  throw new ApiError(
    500,
    "Billing could not be completed because invoice generation did not finish.",
    "INVOICE_GENERATION_FAILED"
  );
};

const getOrders = async ({
  status,
  paymentMethod,
  customerId,
  from,
  to,
  search,
} = {}) => {
  const normalizedStatus = status ? String(status).toLowerCase() : "";
  const normalizedPaymentMethod = paymentMethod
    ? String(paymentMethod).toLowerCase()
    : "";
  const normalizedCustomerId = String(customerId || "").trim();
  const normalizedSearch = String(search || "").trim();

  if (normalizedStatus && !isValidOrderStatus(normalizedStatus)) {
    throw new ApiError(
      400,
      "Status must be completed, cancelled, or refunded.",
      "VALIDATION_ERROR"
    );
  }

  if (normalizedPaymentMethod && !PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
    throw new ApiError(
      400,
      "Payment method must be one of: cash, upi, card, split.",
      "VALIDATION_ERROR"
    );
  }

  const conditions = [];

  if (normalizedStatus) {
    conditions.push(
      normalizedStatus === "completed"
        ? { $or: [{ status: "completed" }, { status: { $exists: false } }] }
        : { status: normalizedStatus }
    );
  }

  if (normalizedPaymentMethod) {
    conditions.push({ paymentMethod: normalizedPaymentMethod });
  }

  if (normalizedCustomerId) {
    if (normalizedCustomerId === "walk_in") {
      conditions.push({ customerId: null });
    } else {
      validateObjectId(normalizedCustomerId, "customer");
      conditions.push({ customerId: normalizedCustomerId });
    }
  }

  if (from || to) {
    const createdAt = {};

    if (from) {
      const parsedFrom = new Date(from);
      if (Number.isNaN(parsedFrom.getTime())) {
        throw new ApiError(400, "Invalid from date.", "VALIDATION_ERROR");
      }
      parsedFrom.setUTCHours(0, 0, 0, 0);
      createdAt.$gte = parsedFrom;
    }

    if (to) {
      const parsedTo = new Date(to);
      if (Number.isNaN(parsedTo.getTime())) {
        throw new ApiError(400, "Invalid to date.", "VALIDATION_ERROR");
      }
      parsedTo.setUTCHours(23, 59, 59, 999);
      createdAt.$lte = parsedTo;
    }

    if (createdAt.$gte && createdAt.$lte && createdAt.$gte > createdAt.$lte) {
      throw new ApiError(400, "From date cannot be later than to date.", "VALIDATION_ERROR");
    }

    conditions.push({ createdAt });
  }

  if (normalizedSearch) {
    const regex = new RegExp(escapeRegex(normalizedSearch), "i");
    conditions.push({
      $or: [
        { invoiceNumber: regex },
        { customerName: regex },
        { customerPhone: regex },
      ],
    });
  }

  const query =
    conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { $and: conditions };
  const orders = await Order.find(query).sort({ createdAt: -1 });

  return orders.map(serializeOrder);
};

const getOrderById = async (id) => {
  validateObjectId(id, "order");
  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found.", "NOT_FOUND");
  }

  return serializeOrder(order);
};

const updateOrderStatus = async (id, status, performedBy = null) => {
  validateObjectId(id, "order");
  const nextStatus = String(status || "").toLowerCase();

  if (!isValidOrderStatus(nextStatus)) {
    throw new ApiError(
      400,
      "Status must be completed, cancelled, or refunded.",
      "VALIDATION_ERROR"
    );
  }

  let resultMessage = "";

  await runInTransaction(async (session) => {
    const order = await Order.findById(id).session(session);

    if (!order) {
      throw new ApiError(404, "Order not found.", "NOT_FOUND");
    }

    const currentStatus = order.status || "completed";

    if (currentStatus === nextStatus) {
      resultMessage = "Order status already up to date.";
      return;
    }

    if (nextStatus === "completed") {
      throw new ApiError(
        400,
        "Completed status cannot be restored manually once changed.",
        "INVALID_STATUS_TRANSITION"
      );
    }

    if (currentStatus !== "completed") {
      throw new ApiError(
        400,
        `Order is already ${currentStatus}. Further stock-impact status changes are not allowed.`,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];

    for (const item of orderItems) {
      const quantity = toNumber(item.quantity, 0);

      await inventoryService.recordAdjustment({
        productId: String(item.productId),
        quantity,
        referenceType: "ORDER",
        referenceId: order.invoiceNumber || String(order._id),
        reason: "Order reversal",
        note: `Stock restored for order ${nextStatus}`,
        movementDate: new Date(),
        metadata: {
          orderId: order._id,
          reason: nextStatus,
        },
        performedBy,
        session,
      });
    }

    order.status = nextStatus;
    if (!order.paymentMethod) {
      order.paymentMethod = "cash";
    }
    await order.save({ session });

    if (order.customerId) {
      await customerService.refreshCustomerStats(String(order.customerId), { session });
    }

    resultMessage = `Order marked as ${nextStatus}. Stock restored successfully.`;
  });

  const updatedOrder = await Order.findById(id);
  return {
    message: resultMessage || "Order updated.",
    order: serializeOrder(updatedOrder),
  };
};

const getOrderInvoice = async (id) => {
  validateObjectId(id, "order");
  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found.", "NOT_FOUND");
  }

  const gstInvoice = buildGstCompliantInvoice(order);
  const items = (order.items || []).map((item, index) => {
    const rawItem = typeof item?.toObject === "function" ? item.toObject() : item || {};
    const invoiceItem = gstInvoice.items[index] || {};

    return {
      ...rawItem,
      ...invoiceItem,
      name: invoiceItem.description || rawItem.name || "Item",
    };
  });

  return {
    orderId: order._id,
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    shop: {
      name: gstInvoice.seller.legalName,
      address: gstInvoice.seller.address,
      gstNumber: gstInvoice.seller.gstin,
      stateCode: gstInvoice.seller.stateCode,
    },
    customer: {
      id: order.customerId,
      name: gstInvoice.buyer.legalName || order.customerName || "Walk-in Customer",
      phone: gstInvoice.buyer.phone,
      email: gstInvoice.buyer.email,
      address: gstInvoice.buyer.address,
      gstin: gstInvoice.buyer.gstin,
      stateCode: gstInvoice.buyer.stateCode,
    },
    seller: gstInvoice.seller,
    buyer: gstInvoice.buyer,
    invoiceCategory: gstInvoice.invoiceCategory,
    status: order.status || "completed",
    paymentMethod: order.paymentMethod || "cash",
    splitPayment: order.splitPayment || { cashAmount: 0, upiAmount: 0 },
    supplyType: gstInvoice.supplyType,
    placeOfSupply: gstInvoice.placeOfSupply,
    items,
    subtotal: order.totalAmount,
    taxableAmount: order.taxableAmount ?? order.totalAmount,
    costAmount: order.costAmount ?? 0,
    profitAmount: order.profitAmount ?? 0,
    gstRate: order.gstRate ?? 0,
    gstAmount: order.gstAmount ?? 0,
    cgstAmount: order.cgstAmount ?? 0,
    sgstAmount: order.sgstAmount ?? 0,
    igstAmount: order.igstAmount ?? 0,
    itemDiscountAmount: order.itemDiscountAmount || 0,
    cartDiscountType: order.cartDiscountType || "flat",
    cartDiscountValue: order.cartDiscountValue || 0,
    cartDiscountAmount: order.cartDiscountAmount || 0,
    discountAmount: order.discountAmount || 0,
    taxBreakdown: gstInvoice.taxBreakdown,
    finalAmount: order.finalAmount,
    gstInvoice,
  };
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  getOrderInvoice,
};
