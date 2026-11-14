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

### 30-second demo (recommended for walkthroughs)

```bash
bash scripts/demo.sh
```

This seeds a **demo teacher account** with real content (two lesson plans whose
schedules come from the multi-grade compiler, training-centre progress, and
community posts), then starts the backend and frontend together.

Sign in at [http://localhost:3000/login](http://localhost:3000/login) with the
credentials the script prints:

| | |
|---|---|
| Email | `demo@thrive.in` |
| Password | `thrive-demo-2026` |

No account yet? Create one at [http://localhost:3000/signup](http://localhost:3000/signup),
or explore as a guest at [http://localhost:3000/try](http://localhost:3000/try) —
no sign-in required, and guest work is migrated into your account when you
register.

A suggested demo route:

1. **Curriculum Studio** (`/compiler`) — build a multi-grade plan; try an
   infeasible input to see it refused with explicit reasons. Then edit one
   teacher turn's activity or minutes and use **Regenerate this section** to
   re-run just that turn from the inputs — every other edit stays put.
2. **Teaching assistant** (`/assistant`) — ask a question, note the per-reply
   sources; switch the reply language to **Hindi**.
3. **Chat** (`/chat`) — the WhatsApp-style bridge; type in Devanagari and it
   replies in Hindi (language is auto-detected on the bridge).
4. **WhatsApp status** (`/api/assistant/whatsapp/status`) — shows *simulation*
   unless real Meta credentials are configured; the webhook and delivery-status
   handling are built either way.

Re-running `seed_demo.py` resets only its own rows (idempotent). To seed into
the default database directly:

```bash
cd backend && ../backend/.venv/bin/python ../scripts/seed_demo.py
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
| `BACKEND_URL` | **Required.** Frontend API proxy target. Dev: `http://127.0.0.1:8000`. On Vercel set it to the backend's public origin, or every `/api/*` call 502s. |
| `WHATSAPP_TOKEN` | Meta Cloud API access token (long string — easy to truncate) |
| `WHATSAPP_PHONE_ID` | Meta "Phone Number ID" (numeric, **not** the phone number) |
| `WHATSAPP_VERIFY_TOKEN` | Any string you pick; must match what you type into Meta's webhook form |
| `WHATSAPP_APP_SECRET` | Meta App Secret — enables `X-Hub-Signature-256` verification |
| `WHATSAPP_DISPLAY_NUMBER` | The bot's public number, shown as a QR/wa.me link on `/demo` |

WhatsApp setup, webhook registration, ngrok testing and the Twilio fallback:
[docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md).

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
