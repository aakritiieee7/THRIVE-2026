#!/usr/bin/env bash
# One-command THRIVE demo: seed the demo account, start backend + frontend.
# Run from the repo root:  bash scripts/demo.sh
# Stops cleanly with Ctrl-C (kills both servers).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# Prefer the project venv if it exists, else fall back to python3.
# $PY is kept ABSOLUTE so it resolves correctly from any subdirectory.
if [[ -x "backend/.venv/bin/python" ]]; then
  PY="$ROOT/backend/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PY="$(command -v python3)"
else
  PY="$(command -v python)"
fi

echo "==> Seeding demo account (demo@thrive.in) …"
(cd backend && "$PY" ../scripts/seed_demo.py)

cleanup() {
  echo ""
  echo "==> Stopping servers"
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting backend on :$BACKEND_PORT"
(cd backend && exec "$PY" -m uvicorn app.main:app --port "$BACKEND_PORT") &
BACKEND_PID=$!

echo "==> Starting frontend on :$FRONTEND_PORT"
(cd frontend && exec npm run dev -- --port "$FRONTEND_PORT") &
FRONTEND_PID=$!

# Wait for backend health before telling the user where to go.
for _ in $(seq 1 50); do
  sleep 0.3
  if curl -fsS "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
    break
  fi
done

cat <<BANNER

  THRIVE is up.

    App:     http://localhost:$FRONTEND_PORT
    Backend: http://127.0.0.1:$BACKEND_PORT/health

  Demo walkthrough:
    1. Open http://localhost:$FRONTEND_PORT/login
    2. Click "Use the demo teacher account", then Sign in
       (email: demo@thrive.in, password: thrive-demo-2026)
    3. Tour: Curriculum Studio (compiler) -> Teaching assistant -> chat

  Ctrl-C stops both servers.

BANNER

wait
