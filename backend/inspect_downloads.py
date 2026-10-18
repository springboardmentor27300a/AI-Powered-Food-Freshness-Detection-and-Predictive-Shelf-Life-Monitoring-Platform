import urllib.request, os, json, hashlib

base = r'D:\infosys\project 1\backend\app\ml\data\raw'
tomato_dir = os.path.join(base, 'tomato')

# Check existing project data
project_dataset = r'D:\infosys\project 1\dataset'
if os.path.exists(project_dataset):
    files = os.listdir(project_dataset)
    print("Files in D:\\infosys\\project 1\\dataset\\:")
    for f in sorted(files):
        path = os.path.join(project_dataset, f)
        if os.path.isfile(path):
            size = os.path.getsize(path)
            print(f"  {f}: {size} bytes")

# Check existing raw copies
print("\nPaneer source files:")
src = r'd:\infosys\scratch\paneer_data'
if os.path.exists(src):
    for f in os.listdir(src):
        path = os.path.join(src, f)
        if os.path.isfile(path):
            print(f"  {f}: {os.path.getsize(path)} bytes")

print("\nSeafood source files:")
src = r'C:\Users\lakshana\.gemini\antigravity-ide\brain\d96bfa95-77dc-4155-acaf-c958ba0eaa8b\scratch\dairy_seafood_audit\seafood'
if os.path.exists(src):
    for f in sorted(os.listdir(src))[:20]:
        path = os.path.join(src, f)
        if os.path.isfile(path):
            print(f"  {f}: {os.path.getsize(path)} bytes")

# Try Dryad API
print("\n=== Trying Dryad API ===")
try:
    req = urllib.request.Request("https://datadryad.org/api/v2/doi/10.5061/dryad.5mkkwh772")
    req.add_header('User-Agent', 'Mozilla/5.0')
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read()
        j = json.loads(data)
        print(f"Response type: {type(j)}")
        if isinstance(j, dict):
            for k, v in j.items():
                val_str = str(v)[:100] if not isinstance(v, (dict, list)) else f"{type(v).__name__} with {len(v)} items"
                print(f"  {k}: {val_str}")
except Exception as e:
    print(f"Dryad API error: {e}")
