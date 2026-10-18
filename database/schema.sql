CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(40) NOT NULL CHECK (
        role IN (
            'consumer',
            'retail_manager',
            'warehouse_operator',
            'food_quality_inspector',
            'administrator'
        )
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL,
    batch_number VARCHAR(80) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    expiry_date DATE NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_items_created_by ON food_items(created_by);
CREATE INDEX IF NOT EXISTS idx_food_items_expiry_date ON food_items(expiry_date);

-- M2: Freshness Analysis History
CREATE TABLE IF NOT EXISTS freshness_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(120),
    classification VARCHAR(40) NOT NULL,
    confidence REAL NOT NULL,
    quality_score INTEGER NOT NULL,
    spoilage_probability REAL NOT NULL,
    predicted_class VARCHAR(80),
    color_metrics TEXT,
    texture_metrics TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freshness_analyses_user_id ON freshness_analyses(user_id);

-- M3: Storage monitoring and transparent shelf-life baseline predictions
CREATE TABLE IF NOT EXISTS storage_conditions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
    analysis_id INTEGER REFERENCES freshness_analyses(id) ON DELETE SET NULL,
    temperature_c REAL NOT NULL,
    humidity_pct REAL NOT NULL CHECK (humidity_pct >= 0 AND humidity_pct <= 100),
    air_circulation VARCHAR(20) NOT NULL,
    light_exposure VARCHAR(20) NOT NULL,
    packaging_type VARCHAR(40) NOT NULL,
    storage_duration_days INTEGER NOT NULL DEFAULT 0 CHECK (storage_duration_days >= 0),
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_storage_conditions_user_id ON storage_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_storage_conditions_food_item_id ON storage_conditions(food_item_id);

CREATE TABLE IF NOT EXISTS shelf_life_predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
    analysis_id INTEGER REFERENCES freshness_analyses(id) ON DELETE SET NULL,
    storage_condition_id INTEGER REFERENCES storage_conditions(id) ON DELETE SET NULL,
    food_type VARCHAR(80) NOT NULL,
    remaining_shelf_life_days INTEGER NOT NULL,
    predicted_expiry_date DATE NOT NULL,
    -- Phase 5: ML predictions report transparent confidence (NULL) instead of a
    -- fabricated percentage, so this column must be nullable.
    confidence REAL,
    risk_level VARCHAR(20) NOT NULL,
    official_freshness_score INTEGER NOT NULL,
    visual_condition_score INTEGER NOT NULL,
    storage_condition_score INTEGER NOT NULL,
    shelf_life_score INTEGER NOT NULL,
    product_age_score INTEGER NOT NULL,
    input_snapshot TEXT NOT NULL,
    recommendations TEXT NOT NULL,
    model_type VARCHAR(40) NOT NULL DEFAULT 'rule_based_baseline',
    -- A6: storage compliance summary (compliant / needs_attention), nullable
    storage_compliance VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shelf_life_predictions_user_id ON shelf_life_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_shelf_life_predictions_created_at ON shelf_life_predictions(created_at);
