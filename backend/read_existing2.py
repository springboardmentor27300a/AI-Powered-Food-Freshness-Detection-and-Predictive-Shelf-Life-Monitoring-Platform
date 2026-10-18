import os, json

# Read existing files from project 1 backend (correct paths)
files = [
    r'D:\infosys\project 1\backend\app\ml\m3.py',
    r'D:\infosys\project 1\backend\app\ml\schemas.py',
    r'D:\infosys\project 1\backend\app\ml\models.py',
    r'D:\infosys\project 1\backend\app\ml\auth.py',
    r'D:\infosys\project 1\backend\app\ml\database.py',
    r'D:\infosys\project 1\backend\app\ml\main.py',
    r'D:\infosys\project 1\backend\api\v1\schemas.py' if os.path.exists(r'D:\infosys\project 1\backend\api') else 'NOT FOUND',
]

for f in files:
    if os.path.exists(f):
        print(f"\n=== {f} ===")
        with open(f, 'r', encoding='utf-8', errors='replace') as fh:
            content = fh.read()
            print(content[:3000])
    else:
        print(f"\n=== {f}: NOT FOUND ===")