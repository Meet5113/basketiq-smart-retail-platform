const ALL_MODULES = ["dashboard", "orders", "pos", "products", "inventory", "customers", "users", "reports"];
const STAFF_MODULE_OPTIONS = ["orders", "pos", "products", "inventory", "customers"];
const STAFF_CORE_MODULES = ["orders", "pos", "customers"];

const normalizeAllowedModules = (role, allowedModules) => {
  const normalizedRole = String(role || "staff").toLowerCase();

  if (normalizedRole === "admin") {
    return [...ALL_MODULES];
  }

  const normalizedModules = Array.isArray(allowedModules)
    ? allowedModules
        .map((moduleName) => String(moduleName || "").trim().toLowerCase())
        .filter((moduleName) => STAFF_MODULE_OPTIONS.includes(moduleName))
    : [];

  const resolvedModules = normalizedModules.length > 0 ? normalizedModules : [...STAFF_MODULE_OPTIONS];

  return [...new Set([...STAFF_CORE_MODULES, ...resolvedModules])];
};

const getDefaultAllowedModules = (role) => normalizeAllowedModules(role, []);

module.exports = {
  ALL_MODULES,
  STAFF_CORE_MODULES,
  STAFF_MODULE_OPTIONS,
  normalizeAllowedModules,
  getDefaultAllowedModules,
};
