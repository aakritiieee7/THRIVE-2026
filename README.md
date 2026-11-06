# THRIVE

**Teacher Hub for Resources, Instruction, Verified Information & Empowerment**
*Helping teachers thrive, helping students flourish.*

THRIVE is an AI-powered teacher-support platform for India's school ecosystem, built for the
Education track of **Code for a Billion — Bharat Agentic-AI Hackathon 2026**.
Repository: [github.com/aakritiieee7/THRIVE-2026](https://github.com/aakritiieee7/THRIVE-2026)

The signature capability is the **Multi-Grade Classroom Compiler**: a deterministic,
constraint-checked engine that plans one coordinated period across several grade groups —
shared opening only when goals genuinely align, dedicated teacher-led turns per grade,
independent work for waiting groups, exact minute accounting, and per-grade assessments.
Impossible schedules are **rejected with explicit reasons** rather than faked.

## The five pillars

1. **Curriculum Studio (flagship)** — curriculum-grounded planning (seeded NCERT-aligned
   chapters, Grades 1–5), the multi-grade compiler, TLM-style material suggestions from
   teacher-entered resources, printable/CSV-exportable schedules, saved & editable plans.
2. **AI Teaching Assistant** — retrieval-grounded answers with per-reply source citations,
   teacher-context aware, Hindi/English. An optional LLM provider (OpenAI-compatible,
   env-configured) composes answers; a deterministic local fallback keeps it working
   offline. The assistant never fabricates curriculum facts: out-of-corpus questions are
   said to be out of corpus.
3. **Training Centre** — short THRIVE-authored practice modules with persistent progress
   (device + account), plus verified links to DIKSHA, NISHTHA and the NEP 2020 policy.
   Progress is a learning record, **not** an official certificate.
4. **Verified Education Updates** — curated, source-linked official resources and policy
   updates with search, categories and bookmarks. No live circulars, no fabricated news.
5. **Teacher Community** — practical peer discussions with replies, helpful reactions,
   bookmarks, reporting and a moderation threshold.

## Run locally

Requirements: Node.js 18+ and Python 3.10+.

### Fast (no Docker, SQLite)

```bash
# 1. Backend on :8000 (auto-creates ./backend/thrive.db)
cd backend
python -m venv .venv && source .venv/bin/activate   # or use your Python
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Frontend on :3000 (proxies /api/* to the backend)
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create an account from
**My profile** or **/signup** — the frontend works in local mode without one.

### Full stack (Docker)

```bash
cp .env.example .env          # set THRIVE_SECRET
docker-compose up --build
```

### Tests

```bash
cd backend
pip install -r requirements.txt pytest httpx
python -m pytest tests/ -q
```

Solver tests cover feasibility rejection, exact minute accounting, teacher
double-booking, independent-work assignment, shared-group handling and exports;
API tests cover auth, ownership, plan CRUD, training, bookmarks, community and
the assistant round-trip on an isolated SQLite database.

## Configuration

See [.env.example](.env.example). Notable keys:

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Postgres in docker-compose; defaults to SQLite (`backend/thrive.db`) |
| `THRIVE_SECRET` | JWT signing secret — **must be set in shared environments** |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | Optional OpenAI-compatible chat model for the assistant; without a key the grounded local fallback runs |
| `BACKEND_URL` | Frontend API proxy target (dev: `http://localhost:8000`) |

## Architecture

Monorepo: `frontend/` (Next.js + TypeScript + Tailwind base + custom design system),
`backend/` (FastAPI + SQLAlchemy + JWT auth, compiler API, assistant, persistence),
`worker/` (background task scaffold), `curriculum/` (canonical schema + seed data +
assistant corpus), `docs/` (architecture, status, next steps). Full detail:
[docs/architecture.md](docs/architecture.md).

## Curriculum coverage — honest limits

The seeded corpus covers **Grades 1–5 core chapters (Mathematics, EVS) aligned to NCERT
structure**. It is illustrative seed data, not validated Bihar SCERT or pan-India syllabus
coverage. Every generated plan labels teacher-entered goals as teacher-provided and
curriculum matches as seeded references; teachers review and edit all output before
classroom use. No copyrighted textbook text is reproduced.

## Responsible AI & privacy

- No student data is collected, needed or stored; the product says so in-app.
- Retrieval-grounded assistant with visible sources; uncertainty is stated.
- LLM output is optional and provider-agnostic; the default path is deterministic.
- Teachers retain final control over classroom decisions.

## Submission

- Public repository: https://github.com/aakritiieee7/THRIVE-2026
- Submission deadline: **15 November 2026** — verify the latest official instructions at
  [codeforindia.org](https://codeforindia.org/) before submitting.
- Licence: MIT.

THRIVE does not claim endorsement or partnership with NCERT, DIKSHA, NISHTHA, the Ministry
of Education, SCERTs or the Azim Premji Foundation.
