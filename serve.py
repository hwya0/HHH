"""
生产入口：用 waitress（纯 Python WSGI server）运行 Flask app

替代 app.pyc 里硬编码的 app.run(host='127.0.0.1', port=5000, debug=False)

特性：
- 监听 0.0.0.0（Docker/云服务器里需要）
- 读 $PORT 环境变量（云平台自动注入），默认 5000
- 直接 import 同目录的 app.pyc（pyc 会被 Python 优先加载）
"""
import os
import sys

# 确保能找到同目录的 app.pyc（Docker 里 WORKDIR /app，serve.py 和 app.pyc 都在 /app/）
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

# import app.pyc（没有 app.py，Python 会自动加载 app.pyc）
import app  # noqa: E402

from waitress import serve  # noqa: E402

port = int(os.environ.get("PORT", 5000))
host = os.environ.get("HOST", "0.0.0.0")

print(f"=== 马原刷题 APP - Production Server ===")
print(f"  waitress 启动于 {host}:{port}")
print(f"  Flask app 对象: {app.app}")
print(f"  routes: {[r.rule for r in app.app.url_map.iter_rules()]}")
print(f"========================================\n")

serve(app.app, host=host, port=port, threads=8)
