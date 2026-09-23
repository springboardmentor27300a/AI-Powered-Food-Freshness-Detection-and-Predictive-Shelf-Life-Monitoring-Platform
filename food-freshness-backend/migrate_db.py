from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print("Migrating database tables 'food_items' and 'freshness_analyses'...")
    conn.execute(text("ALTER TABLE food_items ADD COLUMN IF NOT EXISTS batch_number VARCHAR;"))
    conn.execute(text("ALTER TABLE food_items ADD COLUMN IF NOT EXISTS storage_temp FLOAT;"))
    
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS color_score FLOAT;"))
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS mold_score FLOAT;"))
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS bruising_score FLOAT;"))
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS visual_score FLOAT;"))
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS storage_score FLOAT;"))
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS shelflife_days FLOAT;"))
    conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN IF NOT EXISTS age_score FLOAT;"))

    conn.commit()
    print("Migration successful! Added all sub-feature and weighted model columns.")
