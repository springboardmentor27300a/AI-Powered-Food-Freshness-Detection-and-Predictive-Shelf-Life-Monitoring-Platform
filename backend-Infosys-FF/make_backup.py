import os
import subprocess
from datetime import datetime
from urllib.parse import urlparse, unquote
from dotenv import load_dotenv

# Load env without printing
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("ERROR: DATABASE_URL not found.")
    exit(1)

parsed = urlparse(db_url)
user = parsed.username
password = unquote(parsed.password) if parsed.password else ""
host = parsed.hostname or "localhost"
port = str(parsed.port or 5432)
dbname = parsed.path.lstrip("/")

backup_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")
os.makedirs(backup_dir, exist_ok=True)

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
sql_backup_file = os.path.join(backup_dir, f"food_freshness_db_backup_{timestamp}.sql")

pg_dump_path = r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"
if not os.path.exists(pg_dump_path):
    print("pg_dump.exe not found at default location, trying PATH")
    pg_dump_path = "pg_dump"

env = os.environ.copy()
if password:
    env["PGPASSWORD"] = password

cmd = [
    pg_dump_path,
    "-h", host,
    "-p", port,
    "-U", user,
    "-d", dbname,
    "-F", "p",  # plain text SQL
    "-f", sql_backup_file
]

try:
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode == 0 and os.path.exists(sql_backup_file) and os.path.getsize(sql_backup_file) > 0:
        size_kb = os.path.getsize(sql_backup_file) / 1024
        print(f"SUCCESS: Database backup created successfully at: {sql_backup_file} ({size_kb:.2f} KB)")
    else:
        print(f"FAILED: pg_dump returned code {result.returncode}")
        if result.stderr:
            print(f"stderr: {result.stderr}")
        exit(1)
except Exception as e:
    print(f"ERROR executing pg_dump: {e}")
    exit(1)
