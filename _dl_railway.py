import requests, json, sys, os

# 1. Get latest Railway CLI release info
resp = requests.get('https://api.github.com/repos/railwayapp/cli/releases/latest', timeout=15)
resp.raise_for_status()
data = resp.json()
print(f"Latest version: {data['tag_name']}")

# 2. Find Windows x64 asset
asset_url = None
asset_name = None
for a in data['assets']:
    n = a['name'].lower()
    if ('windows' in n or 'pc-windows' in n) and ('amd64' in n or 'x86_64' in n or 'x64' in n):
        asset_url = a['browser_download_url']
        asset_name = a['name']
        break

if not asset_url:
    print("No windows asset found. Available assets:")
    for a in data['assets']:
        print(f"  {a['name']}")
    sys.exit(1)

print(f"Downloading: {asset_name}")
out_path = r'C:\Users\32388\railway_setup.exe'
with requests.get(asset_url, stream=True, timeout=120) as r:
    r.raise_for_status()
    total = int(r.headers.get('content-length', 0))
    downloaded = 0
    with open(out_path, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded * 100 // total
                mb = downloaded / 1024 / 1024
                print(f"\r  {pct}% ({mb:.1f} MB)", end='', flush=True)
print(f"\nDone! size={os.path.getsize(out_path)} bytes")

# Verify
import subprocess
result = subprocess.run([out_path, '--version'], capture_output=True, text=True)
print(f"--version: {result.stdout.strip() or result.stderr.strip()}")
