#!/bin/bash
set -e

DATA_DIR="/app/data"
TPL_DIR="/app/data_tpl"

echo "=== Mayuan Quiz Entrypoint ==="
echo "Volume mount path: $DATA_DIR"

mkdir -p "$DATA_DIR"

if [ ! -f "$DATA_DIR/questions.json" ]; then
    echo "First run: copying seed data from template..."
    cp "$TPL_DIR/questions.json" "$DATA_DIR/questions.json"
    cp "$TPL_DIR/config.json" "$DATA_DIR/config.json"
    if [ -f "$TPL_DIR/users.json" ]; then
        cp "$TPL_DIR/users.json" "$DATA_DIR/users.json"
    fi
    echo "Seeded questions.json + config.json to persistent volume"
fi

echo "=== DATA dir contents: ==="
ls -la "$DATA_DIR/" | head -20

exec python serve.py