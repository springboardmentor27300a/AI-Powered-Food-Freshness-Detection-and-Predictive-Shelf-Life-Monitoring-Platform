import urllib.request
import os
import json
import hashlib

base = r'D:\infosys\project 1\backend\app\ml\data\raw'
results = {}

# Tomato: Download individual files from Dryad
# Based on the landing page, files are accessible via Dryad API
tomato_url = "https://datadryad.org/api/v2/doi/10.5061/dryad.5mkkwh772"
tomato_dir = os.path.join(base, 'tomato')

try:
    # Try downloading the full dataset zip
    req = urllib.request.Request(tomato_url)
    req.add_header('User-Agent', 'Mozilla/5.0')
    # Dryad API returns metadata JSON, not the zip directly
    # Need to get the actual download URL
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = resp.read()
        print(f"Dryad API response status: {resp.status}")
        print(f"Response length: {len(data)} bytes")
        # Try to parse as JSON to find download links
        try:
            j = json.loads(data)
            print(f"JSON keys: {list(j.keys()) if isinstance(j, dict) else type(j)}")
            # Look for download URL
            if isinstance(j, dict):
                for key in j:
                    if 'download' in str(key).lower() or 'file' in str(key).lower():
                        print(f"  Found: {key}")
        except:
            print("Response is not JSON")
            results['tomato_api'] = "Got non-JSON response"
except Exception as e:
    print(f"Tomato download attempt 1 failed: {e}")
    results['tomato_api'] = str(e)

print("\n--- Attempting alternative download methods ---")

# Try direct file download from Dryad using known file paths
# Dryad individual file downloads
tomato_files = [
    "Shelflife_Tomato_NLED_BWC.xlsx",
    "AA_Tomato_NLED_BWC.xlsx", 
    "Decay_Tomato_NLED_BWC.xlsx",
    "Marketability_Tomato_NLED_BWC.xlsx",
    "pH_Tomato_NLED_BWC.xlsx",
    "TA_Tomato_NLED_BWC.xlsx",
    "TSS_Tomato_NLED_BWC.xlsx",
    "WL_Tomato_NLED_BWC.xlsx",
    "README_file.docx"
]

# Dryad file download URL pattern
for fname in tomato_files:
    file_url = f"https://datadryad.org/api/v2/access/datafile/:persistentId?persistentId=doi:10.5061/dryad.5mkkwh772/{fname}"
    dest = os.path.join(tomato_dir, fname)
    try:
        req = urllib.request.Request(file_url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        # Just check if URL is accessible
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                content_length = resp.headers.get('Content-Length', 'unknown')
                print(f"  {fname}: HTTP {resp.status}, Size: {content_length}")
        except urllib.error.HTTPError as he:
            print(f"  {fname}: HTTP Error {he.code}")
        except Exception as e2:
            print(f"  {fname}: {e2}")
    except Exception as e:
        print(f"  {fname}: Request failed: {e}")

print("\nDone with initial checks")
