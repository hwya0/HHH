#!/bin/bash
set -e

# /app/data 里有镜像自带的 questions.json + config.json
# /app/data/user_data 是持久化卷（空的或之前有 users.json/progress.json）
# 需要把持久化卷里的 users.json/progress.json 链接回 /app/data/

mkdir -p /app/data/user_data

# 如果持久化卷里已经有 users.json，把它放回到 /app/data/
if [ -f /app/data/user_data/users.json ]; then
    cp /app/data/user_data/users.json /app/data/users.json
fi

# 如果持久化卷里已经有 progress.json，放回到 /app/data/
if [ -f /app/data/user_data/progress.json ]; then
    cp /app/data/user_data/progress.json /app/data/progress.json
fi

echo "=== Starting mayuan-quiz ==="
echo "=== DATA dir contents: ==="
ls -la /app/data/

exec python serve.py