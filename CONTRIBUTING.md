# Contributing to THRIVE

Thanks for helping improve THRIVE. This project supports school teachers in
India, so a few rules matter more than style preferences.

## Ground rules

1. **Honest claims only.** Never add partnership, endorsement or usage claims
   we cannot verify (e.g. NCERT, DIKSHA, NISHTHA, SCERTs, Azim Premji
   Foundation). Never fabricate citations or impact metrics.
2. **No student data.** THRIVE does not collect, store or need student PII.
   Any change that would require it is out of scope.
3. **Curriculum limits stay visible.** The seeded corpus is Grades 1–5
   NCERT-aligned seed data, not pan-India coverage. UI and docs must keep
   saying so.
4. **Assistant must cite.** Every assistant reply carries `sources[]`; any
   change to the assistant keeps that contract, and out-of-corpus questions
   must still be admitted honestly.

## One-shot verify + push

```bash
bash scripts/verify_and_push.sh            # clean strays, pytest, npm build,
                                           # /health smoke test, commit & push
bash scripts/verify_and_push.sh --no-push  # verify only
```

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt pytest httpx
python -m pytest tests/ -q
uvicorn app.main:app --reload --port 8000

# Frontend (proxies /api/* to the backend)
cd frontend
npm ci
npm run dev
```

## Pull requests

- Run the test suite and `npm run build` before pushing.
- CI (`.github/workflows/ci.yml`) runs both automatically on push/PR.
- Keep PRs focused; describe verification steps in the PR template.
