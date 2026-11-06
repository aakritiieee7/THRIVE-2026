#!/usr/bin/env bash
# One-shot handoff: clean strays -> verify backend + frontend -> commit & push.
# Run from the repository root:  bash scripts/verify_and_push.sh
# Add --no-push to verify only.
set -euo pipefail

REMOTE="${REMOTE:-https://github.com/aakritiieee7/THRIVE-2026.git}"
BRANCH="${BRANCH:-main}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> 1/5 Cleaning stray files"
rm -rf frontend/pages/lib \
       frontend/pages/lib.tsx \
       frontend/lib/i18n.tsx \
       frontend/pages/api/placeholder-lib.ts
echo "    done"

echo "==> 2/5 Backend tests (pytest)"
(cd backend
  python -m pip install -q -r requirements.txt pytest httpx
  python -m pytest tests/ -q
)
echo "    done"

echo "==> 3/5 Frontend build (validates package-lock.json too)"
(cd frontend
  npm ci
  npm run build
)
echo "    done"

echo "==> 4/5 Backend smoke test (uvicorn -> GET /health)"
(cd backend
  rm -f thrive.db
  python -c "import uvicorn, threading, time, urllib.request, sys
from app.main import app
import app.db as db
db.init_db()
config = uvicorn.Config(app, host='127.0.0.1', port=8765, log_level='warning')
server = uvicorn.Server(config)
t = threading.Thread(target=server.run, daemon=True)
t.start()
for _ in range(50):
    time.sleep(0.2)
    try:
        body = urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=2).read().decode()
        assert 'ok' in body.lower(), body
        print('    health:', body)
        server.should_exit = True
        sys.exit(0)
    except SystemExit:
        raise
    except Exception:
        continue
server.should_exit = True
sys.exit('health check never succeeded')"
)
echo "    done"

if [[ "${1:-}" == "--no-push" ]]; then
  echo "==> 5/5 Skipping push (--no-push). All checks passed."
  exit 0
fi

echo "==> 5/5 Commit & push to $REMOTE ($BRANCH)"
git remote set-url origin "$REMOTE" 2>/dev/null || git remote add origin "$REMOTE"
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "chore: verify, clean strays, and sync with CI-ready state"
fi
git push -u origin "$BRANCH"
echo "==> Pushed. GitHub Actions (pytest + npm build) will run on this push —"
echo "    check the Actions tab of $REMOTE for a green run."
