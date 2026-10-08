/** Domain constants mirrored from the backend (app/constants.py). */

export const ROLES = [
  { value: 'consumer', label: 'Consumer' },
  { value: 'retail_manager', label: 'Retail Manager' },
  { value: 'warehouse_operator', label: 'Warehouse Operator' },
  { value: 'quality_inspector', label: 'Food Quality Inspector' },
  { value: 'administrator', label: 'Administrator' },
]

export const roleLabel = (role) => ROLES.find((r) => r.value === role)?.label || role

export const FOOD_CATEGORIES = [
  'Fruits',
  'Vegetables',
  'Dairy Products',
  'Meat & Poultry',
  'Seafood',
  'Bakery Products',
  'Packaged Foods',
  'Beverages',
]

export const UNITS = ['kg', 'g', 'litres', 'pieces', 'packets']

export const PACKAGING_TYPES = [
  'Crates',
  'Boxes',
  'Cartons',
  'Bottled',
  'Vacuum Packed',
  'Sealed Packets',
  'Loose',
  'Sacks',
  'Wrapped Trays',
]

export const ROLE_DESCRIPTIONS = {
  consumer: 'View and manage your own food inventory and expiry alerts.',
  retail_manager: 'Create and manage food batches for your store, monitor expiry across categories.',
  warehouse_operator: 'Create and manage warehouse stock batches and storage locations.',
  quality_inspector: 'Read-only access: inspect all food batches and expiry details.',
  administrator: 'Full platform oversight of all users and all food batches.',
}

/** Freshness classification labels and styles. */
export const FRESHNESS_CLASSES = [
  { value: 'Fresh', label: 'Fresh', color: 'var(--green-600)', description: 'Excellent condition, no spoilage indicators' },
  { value: 'Good', label: 'Good', color: '#0ea5e9', description: 'Good quality, minor or no degradation' },
  { value: 'Acceptable', label: 'Acceptable', color: 'var(--amber-600)', description: 'Usable but showing early signs of aging' },
  { value: 'Near Spoilage', label: 'Near Spoilage', color: '#f43f5e', description: 'Significant degradation, use immediately' },
  { value: 'Spoiled', label: 'Spoiled', color: 'var(--red-600)', description: 'Not fit for consumption, dispose immediately' },
]

export const RISK_LEVELS = [
  { value: 'low', label: 'Low Risk', badgeClass: 'badge-green' },
  { value: 'moderate', label: 'Moderate Risk', badgeClass: 'badge-amber' },
  { value: 'high', label: 'High Risk', badgeClass: 'badge-red' },
  { value: 'critical', label: 'Critical Risk', badgeClass: 'badge-red' },
]

/* ------------------------------------------------------------------ */
/* Milestone 3 - storage conditions, scoring and alerts.               */
/* ------------------------------------------------------------------ */

/** Allowed storage-condition values (mirrors app/constants.py). */
export const STORAGE_OPTIONS = {
  airCirculation: [
    { value: 'good', label: 'Good (free airflow)' },
    { value: 'moderate', label: 'Moderate (limited)' },
    { value: 'poor', label: 'Poor (stagnant)' },
  ],
  lightExposure: [
    { value: 'low', label: 'Low' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'high', label: 'High / direct light' },
    { value: 'controlled', label: 'Controlled' },
    { value: 'appropriate', label: 'Appropriate (legacy)' },
    { value: 'excessive', label: 'Excessive (legacy)' },
    { value: 'not_applicable', label: 'Not applicable' },
  ],
}

/** Weighted scoring pillars for the overall freshness score. */
export const SCORING_PILLARS = [
  { key: 'visual_condition_score', label: 'Visual Condition', weight: 40 },
  { key: 'storage_condition_score', label: 'Storage Conditions', weight: 25 },
  { key: 'shelf_life_score', label: 'Shelf-Life Prediction', weight: 20 },
  { key: 'product_age_score', label: 'Product Age', weight: 15 },
]

/** Freshness statuses used by the overall scoring engine. */
export const FRESHNESS_STATUSES = ['Fresh', 'Acceptable', 'Needs Attention', 'Spoiled']

/** Weighted risk levels (spoilage risk). */
export const SPOILAGE_RISK = ['Low', 'Moderate', 'High', 'Critical']

/** Recommendation categories. */
export const RECOMMENDATION_CATEGORIES = [
  'storage',
  'consumption',
  'rotation',
  'waste_reduction',
  'quality_improvement',
]

/** Alert types emitted by the alert service. */
export const ALERT_TYPES = ['freshness', 'shelf_life', 'spoilage', 'storage', 'inventory', 'platform']
