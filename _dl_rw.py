import requests, json, sys, os
resp = requests.get('https://api.github.com/repos/railwayapp/cli/releases/latest', timeout=15)
resp.raise_for_status()
data = resp.json()
print("Latest:", data['tag_name'])
asset_url = None
asset_name = None
for a in data['assets']:
    n = a['name'].lower()
    if ('windows' in n or 'pc-windows' in n) and ('amd64' in n or 'x86_64' in n or 'x64' in n):
        asset_url = a['browser_download_url']
        asset_name = a['name']
        print("Found:", a['name'])
        break
if not asset_url:
    print("No windows asset!"); sys.exit(1)
out_path = r'C:\Users\32388\railway_cli.exe'
with requests.get(asset_url, stream=True, timeout=120) as r:
    r.raise_for_status()
    with open(out_path, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
print("Saved:", out_path, "size=", os.path.getsize(out_path))
import subprocess
result = subprocess.run([out_path, '--version'], capture_output=True, text=True, timeout=10)
print("version:", (result.stdout or result.stderr).strip())
