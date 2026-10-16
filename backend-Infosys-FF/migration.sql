-- Back up food_freshness_db before running this migration.

CREATE TABLE IF NOT EXISTS storage_units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    storage_type VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    min_temperature NUMERIC(5,2) NOT NULL,
    max_temperature NUMERIC(5,2) NOT NULL,
    target_temperature NUMERIC(5,2) NOT NULL,
    current_temperature NUMERIC(5,2),
    capacity NUMERIC(12,2),
    capacity_unit VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (min_temperature <= max_temperature),
    CHECK (
        target_temperature >= min_temperature
        AND target_temperature <= max_temperature
    )
);

ALTER TABLE food_batches
ADD COLUMN IF NOT EXISTS storage_unit_id INTEGER
REFERENCES storage_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_food_batches_storage_unit_id
ON food_batches(storage_unit_id);

ALTER TABLE analysis_reports
ADD COLUMN IF NOT EXISTS food_batch_id INTEGER
REFERENCES food_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_analysis_reports_food_batch_id
ON analysis_reports(food_batch_id);


CREATE TABLE IF NOT EXISTS temperature_readings (
    id SERIAL PRIMARY KEY,
    storage_unit_id INTEGER NOT NULL
        REFERENCES storage_units(id) ON DELETE CASCADE,
    temperature NUMERIC(5,2) NOT NULL,
    source VARCHAR(30) NOT NULL DEFAULT 'manual',
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_temperature_readings_storage_unit_id
ON temperature_readings(storage_unit_id);

CREATE INDEX IF NOT EXISTS ix_temperature_readings_recorded_at
ON temperature_readings(recorded_at);


CREATE TABLE IF NOT EXISTS storage_requirements (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    storage_type VARCHAR(50) NOT NULL,
    min_temperature NUMERIC(5,2) NOT NULL,
    max_temperature NUMERIC(5,2) NOT NULL,
    target_temperature NUMERIC(5,2) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    guidance_source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_storage_requirement_category_type
        UNIQUE(category, storage_type),
    CHECK (min_temperature <= max_temperature),
    CHECK (
        target_temperature >= min_temperature
        AND target_temperature <= max_temperature
    )
);


CREATE TABLE IF NOT EXISTS waste_records (
    id SERIAL PRIMARY KEY,
    food_batch_id INTEGER
        REFERENCES food_batches(id) ON DELETE SET NULL,
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    waste_type VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    recorded_date DATE NOT NULL,
    responsible_user_id INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_waste_records_recorded_date
ON waste_records(recorded_date);


CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    days_before_expiry INTEGER,
    duration_minutes INTEGER,
    category VARCHAR(50),
    storage_type VARCHAR(50),
    severity VARCHAR(20) NOT NULL DEFAULT 'Warning',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    food_batch_id INTEGER
        REFERENCES food_batches(id) ON DELETE SET NULL,
    storage_unit_id INTEGER
        REFERENCES storage_units(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_role VARCHAR(50),
    event_key VARCHAR(255) NOT NULL UNIQUE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_notifications_created_at
ON notifications(created_at);

CREATE INDEX IF NOT EXISTS ix_notifications_target_role
ON notifications(target_role);