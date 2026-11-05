Backend notes

- Run with: uvicorn app.main:app --reload --port 8000
- DB: ensure Postgres is running and DATABASE_URL env var set.
- Alembic migrations will be added soon.
- Current API endpoints:
  - GET /health
  - GET /curriculum/sample
  - POST /compiler/run
  - POST /auth/signup
  - GET /auth/me (stub)
