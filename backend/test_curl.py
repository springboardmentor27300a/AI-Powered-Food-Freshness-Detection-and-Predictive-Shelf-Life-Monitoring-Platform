import subprocess, sys

# Use curl.exe (not PowerShell alias) to download from Dryad and Mendeley
# First, find curl.exe
import shutil
curl_path = shutil.which('curl') or shutil.which('curl.exe')
wget_path = shutil.which('wget') or shutil.which('wget.exe')
print(f"curl: {curl_path}")
print(f"wget: {wget_path}")

# Try downloading Tomato from Dryad using the actual file download URL
# Dryad file download URL pattern
tomato_url = "https://datadryad.org/api/v2/doi/10.5061/dryad.5mkkwh772"
print(f"\nTrying Dryad URL: {tomato_url}")
result = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-L', tomato_url], 
                       capture_output=True, text=True, timeout=15, shell=False)
print(f"Dryad API status: {result.stdout.strip()}")

# Try to get file listing from Dryad
file_list_url = "https://datadryad.org/api/v2/access/datafile/3000336"
print(f"\nTrying Dryad file URL: {file_list_url}")
result = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-L', file_list_url],
                       capture_output=True, text=True, timeout=15, shell=False)
print(f"Dryad file status: {result.stdout.strip()}")
