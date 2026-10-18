import urllib.request, os, json, hashlib, shutil, sys

base = r'D:\infosys\project 1\backend\app\ml\data\raw'
tomato_dir = os.path.join(base, 'tomato')
paneer_dir = os.path.join(base, 'paneer')
seafood_dir = os.path.join(base, 'seafood')
all_results = []

def get_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()

def get_size(filepath):
    return os.path.getsize(filepath)

# ── TOMATO ──
# Copy from existing project dataset directory (already verified correct)
print("=== TOMATO ===")
project_dataset = r'D:\infosys\project 1\dataset'
tomato_files = [
    "AA_Tomato_NLED_BWC.xlsx",
    "Decay_Tomato_NLED_BWC.xlsx", 
    "Marketability_Tomato_NLED_BWC.xlsx",
    "pH_Tomato_NLED_BWC.xlsx",
    "README_file.docx",
    "Shelflife_Tomato_NLED_BWC.xlsx",
    "TA_Tomato_NLED_BWC.xlsx",
    "TSS_Tomato_NLED_BWC.xlsx",
    "WL_Tomato_NLED_BWC.xlsx"
]

for fname in tomato_files:
    src = os.path.join(project_dataset, fname)
    dest = os.path.join(tomato_dir, fname)
    if os.path.exists(src):
        shutil.copy2(src, dest)
        size = get_size(dest)
        sha = get_sha256(dest)
        all_results.append({"dataset": "tomato", "file": fname, "size": size, "sha256": sha, "source": "D:\\infosys\\project 1\\dataset\\ (project repo)"})
        print(f"  Copied: {fname} ({size} bytes)")
    else:
        all_results.append({"dataset": "tomato", "file": fname, "size": None, "sha256": None, "source": "MISSING"})
        print(f"  MISSING: {fname}")

# Attempt to download from Dryad to verify integrity
print("\nAttempting Dryad verification download...")
# Try the Dryad file download URL pattern
for fname in tomato_files[:1]:  # Try just one file
    # Dryad provides individual file downloads via their API
    url = f"https://datadryad.org/api/v2/doi/10.5061/dryad.5mkkwh772"
    try:
        req = urllib.request.Request(url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            j = json.loads(data)
            # Look for file download URLs
            print(f"  Dryad API response type: {type(j)}")
            if isinstance(j, dict):
                for k in j.keys():
                    print(f"    Key: {k}")
    except Exception as e:
        print(f"  Dryad download attempt: {e}")

# ── PANEER ──
print("\n=== PANEER ===")
paneer_src = r'd:\infosys\scratch\paneer_data'
paneer_files = os.listdir(paneer_src) if os.path.exists(paneer_src) else []

for fname in paneer_files:
    src = os.path.join(paneer_src, fname)
    dest = os.path.join(paneer_dir, fname)
    if os.path.isfile(src):
        shutil.copy2(src, dest)
        size = get_size(dest)
        sha = get_sha256(dest)
        all_results.append({"dataset": "paneer", "file": fname, "size": size, "sha256": sha, "source": "d:\\infosys\\scratch\\paneer_data\\ (scratch)"})
        print(f"  Copied: {fname} ({size} bytes)")

# ── SEAFOOD ──
print("\n=== SEAFOOD ===")
seafood_src = r'C:\Users\lakshana\.gemini\antigravity-ide\brain\d96bfa95-77dc-4155-acaf-c958ba0eaa8b\scratch\dairy_seafood_audit\seafood'
seafood_files = sorted(os.listdir(seafood_src)) if os.path.exists(seafood_src) else []

for fname in seafood_files:
    src = os.path.join(seafood_src, fname)
    dest = os.path.join(seafood_dir, fname)
    if os.path.isfile(src):
        shutil.copy2(src, dest)
        size = get_size(dest)
        sha = get_sha256(dest)
        all_results.append({"dataset": "seafood", "file": fname, "size": size, "sha256": sha, "source": "C:\\Users\\lakshana\\.gemini\\...\\seafood\\ (scratch)"})
        print(f"  Copied: {fname} ({size} bytes)")

# ── SUMMARY ──
print(f"\n=== SUMMARY ===")
total_files = len(all_results)
total_size = sum(r['size'] for r in all_results if r['size'] is not None)
missing = [r['file'] for r in all_results if r['source'] == 'MISSING']
print(f"Total files copied: {total_files}")
print(f"Total size: {total_size} bytes ({total_size/1024:.1f} KB)")
if missing:
    print(f"Missing files: {missing}")
else:
    print("All expected files present")

# Write results for manifest generation
with open(os.path.join(base, '_results.json'), 'w') as f:
    json.dump(all_results, f, indent=2)
print(f"\nResults saved to {os.path.join(base, '_results.json')}")
