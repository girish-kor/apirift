#!/usr/bin/env bash
# apirift full-flow example
# Usage: ./examples/examples.sh [TARGET_URL]
set -euo pipefail

TARGET="${1:-http://localhost:3000}"
PORT=8080

echo "[1] Starting capture proxy :$PORT -> $TARGET"
node src/cli.js capture \
  --port "$PORT" \
  --target "$TARGET" \
  --output logs/logs.jsonl \
  --mask-fields "password,token" &
PROXY_PID=$!
sleep 2

echo "[2] Sending test traffic..."
curl -sf "http://localhost:$PORT/api/health" > /dev/null || true
curl -sf "http://localhost:$PORT/api/users"  > /dev/null || true

sleep 1
kill "$PROXY_PID" 2>/dev/null; wait "$PROXY_PID" 2>/dev/null || true
echo "[2] Captured $(wc -l < logs/logs.jsonl) entries"

echo "[3] Inspect log"
node src/cli.js inspect --file logs/logs.jsonl

echo "[4] Validate log"
node src/cli.js validate --file logs/logs.jsonl

echo "[5] Replay"
node src/cli.js replay \
  --input  logs/logs.jsonl \
  --target "$TARGET" \
  --output logs/replay.jsonl \
  --concurrency 2

echo "[6] Analyze"
node src/cli.js analyze \
  --baseline  logs/logs.jsonl \
  --candidate logs/replay.jsonl \
  --latency 500 \
  --latency-ratio 2

echo "Done. Check reports/ for drift JSON."
