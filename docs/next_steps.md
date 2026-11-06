# Next steps (after 2026-11-06 build)

The full build is complete — all five pillars are wired to a real backend
with tests (see `docs/status-2026-11-06.md`). Remaining work before the
**2026-11-15** hackathon submission deadline:

1. **Run the handoff script** (the build session's shell was down, so these
   steps have not been executed yet — the script does all of them in order):
   ```bash
   bash scripts/verify_and_push.sh            # clean + test + build + push
   bash scripts/verify_and_push.sh --no-push  # verify only
   ```
   It removes the stray files (`frontend/pages/lib`, `frontend/pages/lib.tsx`,
   `frontend/lib/i18n.tsx`, `frontend/pages/api/placeholder-lib.ts`), runs
   `pytest`, `npm ci && npm run build`, boots uvicorn for a `GET /health`
   smoke test, then commits and pushes.
2. **Commit & push** to https://github.com/aakritiieee7/THRIVE-2026 — the CI
   workflow in `.github/workflows/ci.yml` will then run pytest + frontend
   build automatically on every push; check the Actions tab is green.
   (Manual alternative to step 1: `cd backend && pip install -r
   requirements.txt pytest httpx && python -m pytest tests/ -q`, then
   `cd ../frontend && rm -rf pages/lib && npm ci && npm run build`.)
4. **Deploy** (docker-compose stack or any Node+Python host) and attach the
   live URL to the submission form.
5. **Submission** — check official instructions at codeforindia.org first.

Post-submission ideas (not needed for the deadline):
- E2E tests (Playwright) for the major flows.
- Curriculum ingestion UI (PDF upload → parse → manual validation) for more boards.
- Embedding-based retrieval (FAISS) to replace lexical scoring as corpus grows.
