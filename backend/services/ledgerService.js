const mongoose = require("mongoose");
const LedgerEntry = require("../models/LedgerEntry");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validateObjectId = (id, entity) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${entity} id.`, "INVALID_IDENTIFIER");
  }
};

const validateLedgerType = (ledgerType) => {
  const normalized = String(ledgerType || "").toLowerCase();

  if (normalized !== "customer") {
    throw new ApiError(400, "Only customer ledgers are supported.", "VALIDATION_ERROR");
  }

  return normalized;
};

const validateEntryType = (entryType) => {
  const normalized = String(entryType || "").toLowerCase();

  if (!["debit", "credit"].includes(normalized)) {
    throw new ApiError(400, "Entry type must be debit or credit.", "VALIDATION_ERROR");
  }

  return normalized;
};

const validateAmount = (amount) => {
  const normalized = roundCurrency(toNumber(amount, -1));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new ApiError(400, "Amount must be a positive number.", "VALIDATION_ERROR");
  }

  return normalized;
};

const ensureCustomerExists = async ({ partyId, session }) => {
  const customer = await Customer.findById(partyId).session(session);

  if (!customer) {
    throw new ApiError(404, "Customer not found.", "NOT_FOUND");
  }

  return customer;
};

const createEntry = async ({
  ledgerType,
  partyId,
  entryType,
  amount,
  referenceType,
  referenceId,
  orderId,
  paymentMethod,
  note,
  createdBy,
  metadata,
  entryDate,
  session,
}) => {
  const normalizedLedgerType = validateLedgerType(ledgerType);
  const normalizedEntryType = validateEntryType(entryType);
  const normalizedAmount = validateAmount(amount);

  validateObjectId(partyId, normalizedLedgerType);
  await ensureCustomerExists({ partyId, session });

  if (orderId) {
    validateObjectId(orderId, "order");
  }

  const docs = await LedgerEntry.create(
    [
      {
        ledgerType: normalizedLedgerType,
        partyId,
        entryType: normalizedEntryType,
        amount: normalizedAmount,
        referenceType: String(referenceType || ""),
        referenceId: String(referenceId || ""),
        orderId: orderId || null,
        paymentMethod: String(paymentMethod || ""),
        note: String(note || ""),
        createdBy: createdBy || null,
        metadata: metadata || {},
        entryDate: entryDate || new Date(),
      },
    ],
    { session }
  );

  return docs[0];
};

const getBalance = async ({ ledgerType, partyId }) => {
  const normalizedLedgerType = validateLedgerType(ledgerType);
  validateObjectId(partyId, normalizedLedgerType);

  const [summary] = await LedgerEntry.aggregate([
    {
      $match: {
        ledgerType: normalizedLedgerType,
        partyId: new mongoose.Types.ObjectId(partyId),
      },
    },
    {
      $group: {
        _id: null,
        debit: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "debit"] }, "$amount", 0],
          },
        },
        credit: {
          $sum: {
            $cond: [{ $eq: ["$entryType", "credit"] }, "$amount", 0],
          },
        },
      },
    },
  ]);

  const totalDebit = roundCurrency(summary?.debit || 0);
  const totalCredit = roundCurrency(summary?.credit || 0);
  const netBalance = roundCurrency(totalDebit - totalCredit);

  return {
    ledgerType: normalizedLedgerType,
    partyId,
    totalDebit,
    totalCredit,
    netBalance,
    dueAmount: netBalance > 0 ? netBalance : 0,
    advanceAmount: netBalance < 0 ? Math.abs(netBalance) : 0,
  };
};

const getHistory = async ({ ledgerType, partyId, fromDate, toDate, page = 1, limit = 50 } = {}) => {
  const normalizedLedgerType = validateLedgerType(ledgerType);
  validateObjectId(partyId, normalizedLedgerType);

  const normalizedPage = Math.max(1, toNumber(page, 1));
  const normalizedLimit = Math.min(200, Math.max(1, toNumber(limit, 50)));
  const skip = (normalizedPage - 1) * normalizedLimit;
  const query = {
    ledgerType: normalizedLedgerType,
    partyId,
  };

  if (fromDate || toDate) {
    query.entryDate = {};

    if (fromDate) {
      const parsedFrom = new Date(fromDate);

      if (Number.isNaN(parsedFrom.getTime())) {
        throw new ApiError(400, "Invalid fromDate value.", "VALIDATION_ERROR");
      }

      query.entryDate.$gte = parsedFrom;
    }

    if (toDate) {
      const parsedTo = new Date(toDate);

      if (Number.isNaN(parsedTo.getTime())) {
        throw new ApiError(400, "Invalid toDate value.", "VALIDATION_ERROR");
      }

      query.entryDate.$lte = parsedTo;
    }
  }

  const [entries, total, allEntriesAsc] = await Promise.all([
    LedgerEntry.find(query).sort({ entryDate: -1, _id: -1 }).skip(skip).limit(normalizedLimit),
    LedgerEntry.countDocuments(query),
    LedgerEntry.find(query).sort({ entryDate: 1, _id: 1 }).select("entryType amount"),
  ]);

  let running = 0;
  const balanceById = new Map();

  for (const row of allEntriesAsc) {
    const amount = toNumber(row.amount, 0);
    running += row.entryType === "debit" ? amount : -amount;
    balanceById.set(String(row._id), roundCurrency(running));
  }

  return {
    items: entries.map((entry) => ({
      ...entry.toObject(),
      balanceAfterEntry: balanceById.get(String(entry._id)) || 0,
    })),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages: Math.ceil(total / normalizedLimit) || 1,
    },
  };
};

const postCustomerOrder = async ({
  customerId,
  orderId,
  invoiceNumber,
  totalAmount,
  paidAmount,
  paymentMethod,
  createdBy,
  session,
}) => {
  const normalizedTotal = validateAmount(totalAmount);
  const normalizedPaid = roundCurrency(Math.max(0, Math.min(normalizedTotal, toNumber(paidAmount, 0))));

  await createEntry({
    ledgerType: "customer",
    partyId: customerId,
    entryType: "debit",
    amount: normalizedTotal,
    referenceType: "ORDER",
    referenceId: invoiceNumber || String(orderId || ""),
    orderId,
    paymentMethod,
    note: "Sales invoice posted",
    createdBy,
    metadata: {
      kind: "invoice",
    },
    session,
  });

  if (normalizedPaid > 0) {
    await createEntry({
      ledgerType: "customer",
      partyId: customerId,
      entryType: "credit",
      amount: normalizedPaid,
      referenceType: "ORDER_PAYMENT",
      referenceId: invoiceNumber || String(orderId || ""),
      orderId,
      paymentMethod,
      note: "Payment received against invoice",
      createdBy,
      metadata: {
        kind: "payment",
      },
      session,
    });
  }
};

const recordCustomerPayment = async ({
  customerId,
  amount,
  paymentMethod,
  note,
  referenceId,
  createdBy,
  session,
}) =>
  createEntry({
    ledgerType: "customer",
    partyId: customerId,
    entryType: "credit",
    amount,
    referenceType: "PAYMENT",
    referenceId: String(referenceId || ""),
    paymentMethod,
    note: note || "Customer payment received",
    createdBy,
    session,
  });

module.exports = {
  createEntry,
  getBalance,
  getHistory,
  postCustomerOrder,
  recordCustomerPayment,
};
