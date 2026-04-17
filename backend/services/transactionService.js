const mongoose = require("mongoose");

const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");

  return (
    /Transaction numbers are only allowed on a replica set member or mongos/i.test(message) ||
    /Transaction support is not available/i.test(message) ||
    /This MongoDB deployment does not support retryable writes/i.test(message)
  );
};

const runInTransaction = async (executor) => {
  const session = await mongoose.startSession();
  let result;

  try {
    try {
      await session.withTransaction(async () => {
        result = await executor(session);
      });
    } catch (error) {
      if (!isTransactionUnsupportedError(error)) {
        throw error;
      }

      console.warn("MongoDB transactions are unavailable for the current connection. Falling back to non-transactional execution.");
      result = await executor(null);
    }

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  runInTransaction,
};
