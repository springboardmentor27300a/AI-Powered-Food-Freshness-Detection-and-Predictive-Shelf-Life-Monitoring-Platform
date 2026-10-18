import re

path = r"D:\infosys\project 1\backend\app\Models.py"
with open(path, 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Find all class definitions
classes = re.findall(r'class (\w+)\(', content)
print("Classes in Models.py:")
for c in classes:
    print(f"  {c}")

# Find __tablename__ assignments
tablenames = re.findall(r'__tablename__\s*=\s*["\']([^"\']+)["\']', content)
print("\n__tablename__ values:")
for t in tablenames:
    print(f"  {t}")