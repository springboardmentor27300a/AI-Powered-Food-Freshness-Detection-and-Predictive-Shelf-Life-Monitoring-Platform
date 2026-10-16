from database import engine
from sqlalchemy import text

with engine.begin() as conn:
    res = conn.execute(text("UPDATE users SET role = 'Administrator' WHERE id = 2 AND role = 'admin'"))
    print(f"Updated {res.rowcount} row(s).")
    
    users = conn.execute(text("SELECT id, name, email, role FROM users ORDER BY id")).fetchall()
    print("Current Users in DB:")
    for u in users:
        print(f"  ID {u[0]}: {u[1]} ({u[2]}) -> Role: {u[3]}")
