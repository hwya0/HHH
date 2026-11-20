# Production entry point: waitress replaces hardcoded app.run() in app.pyc
import os
import sys
import shutil
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# Volume path (persistent storage on Railway)
USER_DATA = Path("/app/data/user_data")
DATA_DIR = Path("/app/data")

def _sync_to_volume(filename):
    """After app saves files to DATA_DIR, copy them to persistent volume."""
    src = DATA_DIR / filename
    dst = USER_DATA / filename
    if src.exists():
        try:
            USER_DATA.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(src), str(dst))
        except Exception as e:
            print(f"[sync] Warning: could not copy {filename} to volume: {e}")

# Import app.pyc
import app  # noqa: E402

# Monkey-patch save_users to also sync to volume
_original_save = app.save_users
def _wrapped_save():
    _original_save()
    _sync_to_volume("users.json")
    _sync_to_volume("progress.json")
app.save_users = _wrapped_save

from waitress import serve  # noqa: E402

port = int(os.environ.get("PORT", 5000))
host = os.environ.get("HOST", "0.0.0.0")

print("=" * 55)
print(f"  Mayuan Quiz APP - Production (waitress)")
print(f"  Listening on {host}:{port}")
print(f"  DATA_DIR: {DATA_DIR}")
print(f"  VOLUME:   {USER_DATA}")
print(f"  App routes: {[r.rule for r in app.app.url_map.iter_rules()]}")
print("=" * 55)

serve(app.app, host=host, port=port, threads=8)