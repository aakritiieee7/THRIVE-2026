# THRIVE — Architecture

## Monorepo layout

- `frontend/` — Next.js 13 (pages router) + TypeScript. Custom design system in
  `styles/globals.css` (DM Sans + Manrope), Tailwind base. Mobile-first with a
  bottom nav; print styles for lesson plans.
- `backend/` — FastAPI + SQLAlchemy. JWT auth, compiler API, assistant, plans,
  training progress, bookmarks, community. SQLite by default; Postgres via
  `DATABASE_URL` (docker-compose). Alembic config ships for production migrations.
- `worker/` — Celery background-task scaffold (future: curriculum PDF ingestion,
  RAG reindexing).
- `curriculum/` — canonical curriculum `schema.json`, seeded NCERT-aligned data
  (`ncert_sample.json`, Grades 1–5 Math/EVS), assistant grounding corpus
  (`assistant_sources.json`).
- `docs/` — this file, status snapshots, next steps.

## Request flow

```
Browser → Next.js /api/* (proxy.ts → BACKEND_URL) → FastAPI → SQLite/Postgres
                                                    → solver.py (pure, deterministic)
                                                    → assistant.py (retrieve → LLM | local)
                                                    → curriculum/*.json
```

## Pillar → service map

| Pillar | Backend | Frontend |
|---|---|---|
| Curriculum Studio | `api_compiler` → `solver.compile_schedule` (constraint engine), `/curriculum/chapters` | `pages/compiler.tsx`, `lib/curriculum.ts` |
| AI Assistant | `api.py /assistant/*` → `assistant.respond` (retrieve → LLM/local), messages persisted | `pages/assistant.tsx` |
| Training | `PUT/GET /training/progress` (upsert per course) | `pages/training.tsx` |
| Updates | `PUT/DELETE/GET /updates/bookmarks` (curated item list is static+official) | `pages/updates.tsx` |
| Community | `/community/posts`, replies, reports (moderation threshold = 2) | `pages/community.tsx` |
| Resources | `POST/GET/PUT/DELETE /plans` (teacher-owned, JSON payload) | `pages/resources.tsx` |

## Compiler constraints (solver.py)

C1 every grade gets ≥5 min teacher-led turn · C2 opening ≥4 min, closing ≥6 min ·
C3 total = requested minutes (exact fit) · C4 every non-focused grade gets an
independent activity · C5 teacher never double-booked · C6 no cross-grade topic
merging unless the caller marks a `shared_group` explicitly.
Infeasible inputs return HTTP 422 with the full reason list.

## Data model

teachers · lesson_plans(→teacher) · training_progress(teacher, course_id) ·
update_bookmarks(teacher, item_id) · community_posts(→teacher) ·
community_replies(→post,→teacher) · assistant_messages(→teacher).

## Security & privacy

- JWT (HS256, 14-day TTL), secret from `THRIVE_SECRET` (dev fallback documented).
- PBKDF2 password hashes (passlib).
- Every private endpoint is owner-scoped; cross-owner access returns 404.
- No student data collected; minimal teacher PII (name, email).
- CORS currently permissive for dev; tighten to the deployed frontend origin in
  production deployment.

## AI policy

- `assistant.py` retrieves from the local corpus first (lexical scoring, top-k).
- If `LLM_API_KEY` is set (any OpenAI-compatible endpoint) the model drafts the
  reply under a strict "only use provided sources for facts, cite them, else say
  so" system prompt; any failure falls back to the deterministic grounded path.
- Every reply returns `sources[]` rendered in the UI.

## Deployment

- Dev: two local processes (backend :8000, frontend :3000) or docker-compose.
- Production plan: single Docker host or managed platform — backend + Postgres
  (Supabase/RDS) + static Next.js; `BACKEND_URL` + `THRIVE_SECRET` required.
