# Production entry point: waitress replaces hardcoded app.run() in app.pyc
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import app  # noqa: E402

from waitress import serve  # noqa: E402

port = int(os.environ.get("PORT", 5000))
host = os.environ.get("HOST", "0.0.0.0")

print("=" * 55)
print(f"  Mayuan Quiz APP - Production (waitress)")
print(f"  Listening on {host}:{port}")
print("=" * 55)

serve(app.app, host=host, port=port, threads=8)