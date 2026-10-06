// Central place for role-based UI permissions, so sidebar nav and page
// guards stay in sync with the backend's actual RBAC rules (see
// backend/app/routers/*.py require_role(...) calls — these arrays mirror
// them, they do not invent new rules).

export const ROLES = {
  CONSUMER: "consumer",
  RETAIL_MANAGER: "retail_manager",
  WAREHOUSE_OPERATOR: "warehouse_operator",
  QUALITY_INSPECTOR: "quality_inspector",
  ADMINISTRATOR: "administrator",
};

export const ROLE_LABELS = {
  consumer: "Consumer",
  retail_manager: "Retail Manager",
  warehouse_operator: "Warehouse Operator",
  quality_inspector: "Quality Inspector",
  administrator: "Administrator",
};

// Mirrors backend/app/routers/food.py WRITE_ROLES
export const CAN_EDIT_INVENTORY = ["retail_manager", "warehouse_operator", "administrator"];
// Mirrors backend/app/routers/batches.py CREATE_ROLES
export const CAN_CREATE_BATCH = ["retail_manager", "warehouse_operator", "administrator"];
// Mirrors backend/app/routers/images.py INSPECTOR_ROLES
export const CAN_ANALYZE_IMAGES = ["quality_inspector", "administrator"];
// Mirrors backend/app/routers/storage.py LOGGER_ROLES
export const CAN_LOG_STORAGE = ["warehouse_operator", "administrator"];
// Mirrors backend/app/routers/shelf_life.py ESTIMATOR_ROLES / recommendations.py GENERATOR_ROLES
export const CAN_RUN_PREDICTIONS = ["retail_manager", "warehouse_operator", "quality_inspector", "administrator"];
// Administrator-only areas
export const ADMIN_ONLY = ["administrator"];
