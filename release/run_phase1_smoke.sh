#!/usr/bin/env bash
set -euo pipefail

echo "[phase1-smoke] Starting local stack..."
docker compose -f docker-compose.local.yml up -d --build

echo "[phase1-smoke] Waiting for unified API health..."
for i in {1..60}; do
  if curl -fsS http://localhost:8000/health >/dev/null; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "[phase1-smoke] Unified API did not become healthy in time"
    docker compose -f docker-compose.local.yml logs --tail=200
    exit 1
  fi
  sleep 5
done

echo "[phase1-smoke] Running smoke test..."
python tests/smoke_release_phase1.py --base-url http://localhost:8000

echo "[phase1-smoke] Smoke completed successfully"
