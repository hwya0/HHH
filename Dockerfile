# ======= 马原刷题 APP Dockerfile =======
# 基于 Python 3.14 slim（pyc 是 CPython 3.14 编译的，必须版本匹配）
FROM python:3.14-slim

# 设置工作目录
WORKDIR /app

# 1. 先复制 requirements（利用 Docker layer cache，依赖不变就不用重装）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. 复制应用代码
#    - app.pyc       后端（没有 .py 源码，直接跑 pyc）
#    - serve.py      生产入口（waitress 替代 app.run）
#    - templates/    前端 HTML
#    - static/       前端 JS、图片
#    - data/         题库、用户、配置（数据文件！）
COPY app.pyc serve.py ./
COPY templates ./templates
COPY static ./static
COPY data ./data

# 3. 持久化数据卷（容器重启不丢 users.json/progress.json）
#    Railway/Render/Zeabur 会把这个挂载到平台的 persistent volume
VOLUME ["/app/data"]

# 4. 云平台会注入 PORT 环境变量，waitress 监听 0.0.0.0:$PORT
ENV HOST=0.0.0.0
ENV PORT=5000
EXPOSE 5000

# 5. 生产启动
CMD ["python", "serve.py"]
