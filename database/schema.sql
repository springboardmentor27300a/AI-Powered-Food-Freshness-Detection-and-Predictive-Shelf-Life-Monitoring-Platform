-- ============================================================================
-- Food Freshness Monitoring Platform - PostgreSQL schema (Milestone 1)
-- ----------------------------------------------------------------------------
-- The FastAPI backend creates these tables automatically on first startup via
-- SQLAlchemy (Base.metadata.create_all in app/main.py). This script documents
-- the exact same schema and can be used when you prefer to set up the database
-- manually or hand it to a DBA.
--
-- Usage (from a terminal with psql on PATH):
--   psql -U postgres -c "CREATE DATABASE food_freshness_db;"
--   psql -U postgres -d food_freshness_db -f database/schema.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table: users
-- One row per registered platform account. Passwords are stored ONLY as
-- bcrypt hashes produced by passlib (never plain text).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL     PRIMARY KEY,
    full_name     VARCHAR(120)  NOT NULL,
    email         VARCHAR(255)  NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(40)   NOT NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_email') THEN
        ALTER TABLE users ADD CONSTRAINT uq_users_email UNIQUE (email);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_users_role ON users (role);

-- ---------------------------------------------------------------------------
-- Table: food_batches
-- One row per registered food batch. batch_id follows the documented format
-- <FOOD3>-<YYYYMMDD>-<NNN> (e.g. APP-20260821-001) and is globally unique.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_batches (
    id                 BIGSERIAL        PRIMARY KEY,
    batch_id           VARCHAR(40)      NOT NULL,
    user_id            BIGINT           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    food_name          VARCHAR(150)     NOT NULL,
    category           VARCHAR(60)      NOT NULL,
    quantity           DOUBLE PRECISION NOT NULL,
    available_quantity DOUBLE PRECISION NOT NULL,
    unit               VARCHAR(30)      NOT NULL,
    received_date      DATE             NOT NULL,
    expiry_date        DATE             NOT NULL,
    storage_location   VARCHAR(150)     NOT NULL,
    packaging_type     VARCHAR(80)      NOT NULL,
    notes              TEXT,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT uq_food_batches_batch_id UNIQUE (batch_id),
    -- Business rules mirrored from the API layer:
    CONSTRAINT ck_batches_positive_quantity CHECK (quantity > 0 AND available_quantity >= 0),
    CONSTRAINT ck_batches_valid_dates       CHECK (expiry_date >= received_date)
);

CREATE INDEX IF NOT EXISTS ix_food_batches_user_id     ON food_batches (user_id);
CREATE INDEX IF NOT EXISTS ix_food_batches_category    ON food_batches (category);
CREATE INDEX IF NOT EXISTS ix_food_batches_expiry_date ON food_batches (expiry_date);
CREATE INDEX IF NOT EXISTS ix_food_batches_received    ON food_batches (received_date);

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current on every UPDATE of food_batches.
-- (SQLAlchemy's onupdate=func.now() already does this at ORM level; this
--  protects rows modified directly in SQL.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_food_batches_updated_at ON food_batches;
CREATE TRIGGER trg_food_batches_updated_at
    BEFORE UPDATE ON food_batches
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
