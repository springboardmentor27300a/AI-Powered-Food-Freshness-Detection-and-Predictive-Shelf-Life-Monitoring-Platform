import urllib.request, os, json, hashlib, sys

base = r'D:\infosys\project 1\backend\app\ml\data\raw'
tomato_dir = os.path.join(base, 'tomato')
paneer_dir = os.path.join(base, 'paneer')
seafood_dir = os.path.join(base, 'seafood')

results = {"tomato": [], "paneer": [], "seafood": [], "errors": []}

def try_download(url, dest, label, timeout=15):
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            with open(dest, 'wb') as f:
                f.write(data)
            size = len(data)
            sha256 = hashlib.sha256(data).hexdigest()
            results[label].append({"file": os.path.basename(dest), "size": size, "sha256": sha256, "status": "OK"})
            return True, size, sha256
    except urllib.error.HTTPError as e:
        results["errors"].append(f"{label}: HTTP {e.code} for {url}")
        return False, None, None
    except Exception as e:
        results["errors"].append(f"{label}: {str(e)} for {url}")
        return False, None, None

# Check Dryad API for file listing
print("=== Checking Dryad API ===")
try:
    req = urllib.request.Request("https://datadryad.org/api/v2/doi/10.5061/dryad.5mkkwh772")
    req.add_header('User-Agent', 'Mozilla/5.0')
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read()
        j = json.loads(data)
        # Look for file download URLs in the response
        if isinstance(j, dict):
            files = j.get('fileObjects', j.get('files', []))
            if isinstance(files, list):
                for f in files:
                    if isinstance(f, dict):
                        print(f"  File: {f.get('name', 'unknown')}, URL available: {f.get('downloadUrl', 'N/A')}")
            # Check for download URL pattern
            print(f"\n  Response keys: {list(j.keys())}")
except Exception as e:
    print(f"  Dryad API error: {e}")

# Try downloading individual files from Dryad using direct URLs
print("\n=== Attempting Tomato downloads ===")
# Dryad direct file downloads often use these patterns
tomato_file_urls = [
    # Try the Dryad file download service
    ("https://datadryad.org/api/v2/access/datafile/3000336", "Shelflife_Tomato_NLED_BWC.xlsx"),
]

# Just check what's already in the project dataset directory
print("\n=== Checking existing project data ===")
project_dataset = r'D:\infosys\project 1\dataset'
if os.path.exists(project_dataset):
    files = os.listdir(project_dataset)
    print(f"Files in D:\\infosys\\project 1\\dataset\\: {files}")
    for f in files:
        path = os.path.join(project_dataset, f)
        size = os.path.getsize(path)
        print(f"  {f}: {size} bytes")

# Check existing raw copies
print("\n=== Checking existing raw copies ===")
for src_dir, label in [(r'd:\infosys\scratch\paneer_data', 'paneer'), 
                         (r'C:\Users\lakshana\.gemini\antigravity-ide\brain\d96bfa95-77dc-4155-acaf-c958ba0eaa8b\scratch\dairy_seafood_audit\seafood', 'seafood')]:
    if os.path.exists(src_dir):
        files = os.listdir(src_dir)
        print(f"{label} files in {src_dir}: {files}")
        for f in files:
            path = os.path.join(src_dir, f)
            if os.path.isfile(path):
                print(f"  {f}: {os.path.getsize(path)} bytes")

print("\nDone")
