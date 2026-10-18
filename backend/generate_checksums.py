import hashlib, os, json

base = r'D:\infosys\project 1\backend\app\ml\data\raw'
datasets = {
    'tomato': {
        'source': 'Dryad',
        'doi': '10.5061/dryad.5mkkwh772',
        'url': 'https://datadryad.org/dataset/doi:10.5061/dryad.5mkkwh772',
        'version': 'April 26, 2022',
        'license': 'CC BY 4.0',
        'citation': 'Shonte, Tigist Tadesse; Zewdie, Biruk; Woldetsadik, Kebede (2022). Data from: Shelf life and quality of tomato (Lycopersicon esculentum Mill.) fruits as affected by neem leaf extract dipping and beeswax coating [Dataset]. Dryad. https://doi.org/10.5061/dryad.5mkkwh772'
    },
    'paneer': {
        'source': 'Mendeley Data',
        'doi': '10.17632/rd9dmr54xx.2',
        'url': 'https://data.mendeley.com/datasets/rd9dmr54xx/2',
        'version': '2',
        'license': 'CC BY 4.0',
        'citation': 'Deep, A., Jindal, N. & Prasad, K. (2026). Storage study data for paneer in controlled RH and Temperature environment [Dataset]. Mendeley Data. https://doi.org/10.17632/rd9dmr54xx.2'
    },
    'seafood': {
        'source': 'Mendeley Data',
        'doi': '10.17632/vx4ptwk3pb.1',
        'url': 'https://data.mendeley.com/datasets/vx4ptwk3pb/1',
        'version': '1',
        'license': 'CC BY 4.0',
        'citation': 'Prasetyo, E. et al. (2024). Dataset for Fish\'s Freshness Problems [Dataset]. Mendeley Data. https://doi.org/10.17632/vx4ptwk3pb.1'
    }
}

checksum_lines = []
all_files = []

for ds_name, ds_info in datasets.items():
    ds_dir = os.path.join(base, ds_name)
    files = sorted(os.listdir(ds_dir))
    checksum_lines.append(f"\n## {ds_name.upper()}")
    checksum_lines.append(f"Source: {ds_info['source']}")
    checksum_lines.append(f"DOI: {ds_info['doi']}")
    checksum_lines.append(f"Version: {ds_info['version']}")
    checksum_lines.append(f"URL: {ds_info['url']}")
    checksum_lines.append(f"License: {ds_info['license']}")
    checksum_lines.append(f"Citation: {ds_info['citation']}")
    checksum_lines.append(f"Directory: {ds_dir}")
    checksum_lines.append(f"File count: {len(files)}")
    total_size = 0
    for fname in files:
        fpath = os.path.join(ds_dir, fname)
        if os.path.isfile(fpath):
            with open(fpath, 'rb') as f:
                sha = hashlib.sha256(f.read()).hexdigest()
            size = os.path.getsize(fpath)
            total_size += size
            checksum_lines.append(f"\n  {fname}")
            checksum_lines.append(f"    SHA256: {sha}")
            checksum_lines.append(f"    Size: {size} bytes")
            all_files.append({"dataset": ds_name, "file": fname, "sha256": sha, "size": size})
    checksum_lines.append(f"\n  Total: {len(files)} files, {total_size} bytes ({total_size/1024:.1f} KB)")

# Write checksums file
checksum_content = "# M3 Dataset Checksums\n\nGenerated: 2026-09-25\n\n"
checksum_content += "\n".join(checksum_lines)
with open(os.path.join(base, 'DATASET_CHECKSUMS.txt'), 'w') as f:
    f.write(checksum_content)
print("DATASET_CHECKSUMS.txt written")

# Write manifest
manifest = "# M3 Dataset Manifest\n\n"
manifest += "## Overview\n\n"
manifest += "Official raw datasets used to train the M3 shelf-life prediction models.\n\n"

for ds_name, ds_info in datasets.items():
    ds_dir = os.path.join(base, ds_name)
    files = sorted(os.listdir(ds_dir))
    total_size = sum(os.path.getsize(os.path.join(ds_dir, f)) for f in files if os.path.isfile(os.path.join(ds_dir, f)))
    manifest += f"## {ds_name.upper()}\n\n"
    manifest += f"**Source:** {ds_info['source']}\n\n"
    manifest += f"**DOI:** {ds_info['doi']}\n\n"
    manifest += f"**Official Landing Page:** {ds_info['url']}\n\n"
    manifest += f"**Version:** {ds_info['version']}\n\n"
    manifest += f"**License:** {ds_info['license']}\n\n"
    manifest += f"**Citation:** {ds_info['citation']}\n\n"
    manifest += f"**Raw Directory:** `{ds_dir}/`\n\n"
    manifest += f"**File Count:** {len(files)}\n\n"
    manifest += f"**Total Size:** {total_size} bytes ({total_size/1024:.1f} KB)\n\n"
    manifest += "### Files\n\n"
    for fname in files:
        fpath = os.path.join(ds_dir, fname)
        if os.path.isfile(fpath):
            size = os.path.getsize(fpath)
            manifest += f"- `{fname}` ({size} bytes)\n"
    manifest += "\n"

manifest += "## Source URLs\n\n"
manifest += f"- **Tomato (Dryad):** {datasets['tomato']['url']}\n"
manifest += f"- **Paneer (Mendeley):** {datasets['paneer']['url']}\n"
manifest += f"- **Seafood (Mendeley):** {datasets['seafood']['url']}\n\n"

manifest += "## Licensing\n\n"
manifest += f"- **Tomato:** {datasets['tomato']['license']}\n"
manifest += f"- **Paneer:** {datasets['paneer']['license']}\n"
manifest += f"- **Seafood:** {datasets['seafood']['license']}\n\n"

manifest += "---\n\n*Generated from official sources. Raw files are preserved as downloaded.*\n"

with open(os.path.join(base, 'DATASET_MANIFEST.md'), 'w') as f:
    f.write(manifest)
print("DATASET_MANIFEST.md written")

print(f"\nAll checksums generated for {len(all_files)} files")
print(f"Total size: {sum(f['size'] for f in all_files)} bytes")
