# THRIVE

**Teacher Hub for Resources, Instruction, Verified Information & Empowerment**
*Helping teachers thrive, so students flourish.*

**Live app: <https://thrive-2026-nine.vercel.app>**
**Demo video: <https://drive.google.com/file/d/1tM15X2jlS93riI-loVnXm5DEc7X6Xxlr/view?usp=sharing>**

Education track, Code for a Billion, Bharat Agentic-AI Hackathon 2026.
Team STAR, THRIVEforTeachers (Aakriti Rajhans, [@aakritiieee7](https://github.com/aakritiieee7)).

---

## What THRIVE is

THRIVE is a teacher support hub built for the classrooms most edtech tools leave out: one
teacher, several grades, one clock. It plans a coordinated multi-grade period with the
minutes actually adding up, answers curriculum questions with the sources attached, and
keeps training, official updates, saved work and peer advice in the same place. The aim is
simple. Give a teacher back the time and confidence to look each child in the eye, not just
push more content at them.

## The problem

| Fact | Figure | Source |
|---|---|---|
| Schools in India | 14.72 lakh | [UDISE+ 2023-24](https://www.education.gov.in/sites/upload_files/mhrd/files/udise_2023_24.pdf) |
| Students enrolled | 24.8 crore | UDISE+ 2023-24 |
| Schools with a single teacher for every grade | 1.16 lakh (about 7.9%) | UDISE+ 2023-24 |
| Std III children in rural India who can read a Std II text | 23.4% | [ASER 2024](https://asercentre.org/wp-content/uploads/2025/01/ASER-2024-National-Findings.pdf) |

Behind those numbers is one teacher holding three or four grades in the same period, along
with records, parents and school admin. Roughly one school in thirteen runs this way. It is
why a child in Grade 2 so often waits for a second explanation while the teacher is with
Grade 4. THRIVE exists to make that classroom workable.

Three children, one afternoon.

A Std 2 child cannot yet read the word on the board. The teacher is with Std 4 finishing
their fractions exercise, and will not be free for another seventeen minutes. By the time
she reaches Std 2, the child has copied the whole sentence wrong and will not raise a hand
again. That afternoon, and the ten that follow it, is where a reading gap becomes a learning
gap becomes a dropout.

THRIVE is built so that afternoon ends differently. The compiler writes the seventeen minutes
down, gives Std 2 an independent task they can actually do alone, and puts the teacher facing
the child who needs her most at the minute she is free.

## What it does

Six working surfaces, all live on the deployed app.

**1. Curriculum Studio, the Multi-Grade Classroom Compiler.** Our flagship feature.
Enter which grades are in the room, for how long, and what should be learnt. THRIVE returns
one coordinated period:

- a shared opening only where the goals genuinely overlap
- a dedicated teacher-led turn for each grade
- independent work assigned to the groups who are waiting
- exact minute accounting, with no double bookkeeping
- a grade-specific assessment close

If the request cannot fit the time available, the compiler refuses with explicit reasons
instead of inventing a schedule. Any single section can be regenerated on its own, so a
teacher's edits are never overwritten. Plans print, export to CSV, and save.

**2. AI Teaching Assistant.** Retrieval-grounded answers from THRIVE's curriculum corpus,
with per-reply source citations, in English and Hindi, aware of the teacher's grade and
subject. Out-of-corpus questions get an explicit "no verified source" reply, never a guess.

**3. Training Centre.** Short practice modules with persistent progress, plus verified links
to DIKSHA, NISHTHA and the NEP 2020 policy. A learning record, not a certificate.

**4. Verified Education Updates.** Source-linked official resources and policy updates with
search, categories and bookmarks. No live circulars, no invented announcements.

**5. Teacher Community.** Peer discussion with replies, helpful reactions, bookmarks,
reporting and a moderation threshold.

**6. My Resources.** Every saved plan in one place: filter by subject, search across grades
and topics, reopen in the studio, duplicate, or export.

**Plus WhatsApp.** Teachers can message THRIVE on Meta's WhatsApp Cloud API and get the same
grounded answers from a phone.

## What one teacher gets back

Take a teacher running Grades 3, 4 and 5 in a single 40 minute period. Today she plans three
schedules in her head, borrows activities she has never tried, and finds out at minute 25
that she is ten minutes short.

| Before | With THRIVE |
|---|---|
| Three separate lesson plans, prepared after school | One coordinated period, compiled in the app |
| Minute counting by guesswork | Every minute placed and checked before class starts |
| Waiting grades given "anything to keep busy" | A named independent task per waiting group |
| A question answered from memory during class | An assistant reply with the curriculum source attached |
| Policy updates found across circulars and WhatsApp forwards | Source-linked updates in one place |
| Professional development as an annual workshop | Short modules with progress saved |

The teacher keeps what changes. The hours spent assembling it are what the tool gives back.

## Why THRIVE is different

- **It plans, it does not chat.** The compiler is a deterministic constraint solver. The same
  input always gives the same schedule, the minutes always add up, and an impossible request
  is refused with reasons.
- **It cites before it answers.** Every assistant reply carries its curriculum sources, and
  the assistant says when it has none.
- **It is built for the multi-grade room,** not for a single grade lesson planner.
- **It reaches teachers on a phone,** through WhatsApp, not only on a laptop.
- **It runs with no API key at all.** The grounded fallback is deterministic.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 13.4 (Pages Router), React 18, TypeScript 5 | Static pages, 86 kB shared JS, one serverless proxy route |
| UI | Tailwind CSS 3.4 plus a custom design system (Fraunces, Manrope, print styles) | Mobile first, printable plans, works on a low-end phone |
| API | FastAPI, Pydantic, uvicorn (Python 3.11) | Typed models, OpenAPI docs at `/docs` |
| Data | SQLAlchemy with SQLite or PostgreSQL | Zero config locally, Postgres in docker-compose |
| Auth | JWT (`python-jose`, `passlib`) | Account and guest sessions, guest work moves into a new account |
| Planner | Pure Python constraint solver (`backend/app/solver.py`) | Deterministic, testable, explainable |
| Assistant | Retrieval over `curriculum/assistant_sources.json`, optional OpenAI-compatible LLM, deterministic fallback | Grounded with citations by construction |
| Messaging | Meta WhatsApp Business Cloud API, HMAC signature check, message dedup | Teachers' real device is a phone |
| Background | Celery scaffold (`worker/`) | Reserved for curriculum ingestion and reindexing |
| Deploy | Vercel for the frontend, Fly.io for the backend (Docker, region `sin`) | Global CDN plus a region close to Indian users |
| Demo video | Pillow overlays, ffmpeg, Microsoft `en-IN-NeerjaNeural` TTS | Reproducible narrated video |

## Architecture

```
                     +
   teacher's phone   |  Next.js frontend  (Vercel)
   or laptop  ------>|  /compiler /assistant /training /updates
                     |  /community /resources /demo /try
                     |
                     |  pages/api/[...proxy].ts  forwards /api/*
                     +-----------------------------+
                                                   |  BACKEND_URL
                                                   v
                     +---------------------------------------------+
                     |  FastAPI backend  (Fly.io, region sin)      |
                     |                                             |
                     |  api_auth.py       JWT, guest sessions      |
                     |  api_compiler.py   calls solver.py          |
                     |  api.py            plans, training, posts   |
                     |  assistant.py      retrieve, then LLM/local |
                     |  whatsapp_*.py     webhook, messages        |
                     +----------+----------------+-----------------+
                                |                |
                 +--------------v-----+   +------v-----------------+
                 | SQLAlchemy         |   | curriculum/ (in image) |
                 | SQLite or Postgres |   | schema.json            |
                 | users, plans,      |   | ncert_sample.json      |
                 | progress, posts    |   | assistant_sources.json |
                 +--------------------+   +------------------------+

   WhatsApp  --webhook-->  /assistant/whatsapp  (HMAC check, dedup)
   (Meta Cloud API)
```

Two agentic surfaces, both constrained. The planner composes a period and cannot invent a
feasible looking schedule. The assistant retrieves, cites, and reports when the corpus does
not cover a question.

```
frontend/     Next.js pages, components, design system, API proxy
backend/      FastAPI app, solver, assistant, WhatsApp, 58 tests
curriculum/   schema, seeded Grades 1 to 5 Math/EVS data, assistant corpus
worker/       Celery scaffold
scripts/      demo.sh, seed_demo.py
media/        demo video, voiceover track, subtitles
docs/         architecture, WhatsApp setup, deployment, test report
```

## Try it

Open <https://thrive-2026-nine.vercel.app/try>. No account needed.

A two minute route:

1. `/compiler`: enter Grades 3 and 5, 40 minutes, a goal per grade. Get a compiled period and
   look at the minute totals. Now shrink the time and watch it refuse with reasons. Edit one
   turn and use **Regenerate this section**.
2. `/assistant`: ask "How do I explain evaporation with chalk and a blackboard?" You get an
   answer with three cited sources. Switch the reply language to Hindi.
3. Browse `/training`, `/updates`, `/community`, `/resources`.

## Run it locally

You need Node.js 18 or newer, and Python 3.10 or newer.

```bash
bash scripts/demo.sh
```

This seeds a demo teacher account with two compiled plans, training progress and community
posts, then starts both servers. Sign in at [localhost:3000/login](http://localhost:3000/login)
with `demo@thrive.in` and `thrive-demo-2026`.

To run each part by hand:

```bash
# backend on port 8000, creates ./backend/thrive.db
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend on port 3000
cd ../frontend
npm install
npm run dev
```

The only setting you need locally is `BACKEND_URL=http://127.0.0.1:8000` for the frontend.
Everything else in [.env.example](.env.example) is optional.

## Tests

```bash
cd backend
pip install -r requirements.txt pytest httpx
python -m pytest tests/ -q
```

58 tests pass. They cover solver feasibility and rejection, minute accounting, teacher
double booking, independent work, shared groups, auth and ownership, plan CRUD, training,
bookmarks, community, and the assistant round trip on an isolated database.

## Coverage

The seeded curriculum covers Grades 1 to 5 core chapters in Mathematics and EVS, aligned to
NCERT structure. It is illustrative seed data, not validated coverage for every board or
state. Plans label teacher-entered goals as teacher provided, and a teacher reviews before
use. No copyrighted textbook text is reproduced.

## Where this is going

A pilot of 10 schools and 50 teachers would measure planning time saved, plans generated,
monthly active teachers, and classroom preparedness against a baseline. State departments,
DIETs and NGOs would support curriculum alignment and regional language localisation.

## What we do not claim

- No field users, schools or outcome numbers yet.
- No endorsement or partnership with NCERT, DIKSHA, NISHTHA, the Ministry of Education,
  SCERTs or the Azim Premji Foundation.
- Training modules are not certifications.
- No student data is collected, needed or stored.

## Licence

MIT, see [LICENSE](LICENSE).
