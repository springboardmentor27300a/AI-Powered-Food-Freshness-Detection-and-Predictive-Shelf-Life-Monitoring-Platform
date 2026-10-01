from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE freshness_analyses ADD COLUMN risk_level VARCHAR DEFAULT 'Low Risk'"))
        conn.commit()
        print('Added risk_level column successfully')
    except Exception as e:
        print(f'Column may already exist or error: {e}')
