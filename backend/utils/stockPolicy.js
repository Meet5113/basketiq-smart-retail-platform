const STOCK_POLICY_OPTIONS = ["block", "warn"];

const getInsufficientStockMode = () => {
  const normalized = String(process.env.POS_INSUFFICIENT_STOCK_MODE || "block")
    .trim()
    .toLowerCase();

  return STOCK_POLICY_OPTIONS.includes(normalized) ? normalized : "block";
};

module.exports = {
  STOCK_POLICY_OPTIONS,
  getInsufficientStockMode,
};
