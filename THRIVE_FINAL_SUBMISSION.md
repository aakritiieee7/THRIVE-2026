# THRIVE — Final Submission Pack

**Event:** Code for a Billion — Bharat Agentic-AI Hackathon 2026
**Track:** Education
**Deadline:** 15 November 2026
**Prepared:** 15 November 2026 — everything below was checked live on this date.

> **Nothing has been committed, pushed or submitted.** Every Git command you need is in
> §7; you run them. This file is written so you can copy the issue body straight into
> GitHub.

---

## 1. Submission fields

| Field | Value |
|---|---|
| Issue title | `[Submission] THRIVE — Teacher Hub for Resources, Instruction, Verified Information & Empowerment` |
| Track | **Education** |
| Team name | *THRIVE (edit to your registered team name if different)* |
| Team members | *<full name, GitHub username, email> — fill in* |
| Team lead contact | *<name, email, phone> — fill in* |
| Repository | https://github.com/aakritiieee7/THRIVE-2026 (public, MIT) |
| Live demo | https://thrive-2026-nine.vercel.app |
| Demo video | `THRIVE_DEMO.mp4` in the repository root — 2 m 50 s, 1080p, narrated, captioned |
| Voiceover track | `THRIVE_VOICEOVER.mp3` |
| Subtitles | `THRIVE_SUBTITLES.srt` (36 cues) |
| Backend | FastAPI on Fly.io (`thrive-2026-api`, region `sin`) |

---

## 2. Issue body (copy from here)

### The problem

In India's small government and low-fee schools, a single teacher frequently teaches two
to five grade groups in the same room in the same period. Teachers have no coordinated way
to plan such a period: which grade gets direct teaching first, what the other groups do
meanwhile, and whether the minutes actually fit. Circulars and curriculum guidance arrive
in fragmented form across DIKSHA, NISHTHA, SCERT and department notices, and a working
teacher has no realistic way to check the syllabus source for an answer before using it in
class.

THRIVE targets that specific constraint — one teacher, several grades, one period — rather
than generic lesson-planning.

### What THRIVE is

**Teacher Hub for Resources, Instruction, Verified Information & Empowerment** — five
capabilities in one app, built around multi-grade reality:

1. **Curriculum Studio (flagship) — Multi-Grade Classroom Compiler.**
   The teacher states which grades are present, how long the period is, and what should be
   learnt. The compiler builds one coordinated period: a shared opening only where goals
   genuinely align, a dedicated teacher-led turn per grade, independent work for waiting
   groups, exact minute accounting, per-grade assessments. Impossible schedules are
   **rejected with explicit reasons**, never faked. Output is printable and CSV-exportable,
   saved, editable, and any single section can be regenerated without losing the teacher's
   own edits.

2. **AI Teaching Assistant.** Retrieval-grounded answers from THRIVE's curriculum corpus,
   with **per-reply source citations**, English and Hindi, aware of the teacher's grade and
   subject context. Optional LLM composition (OpenAI-compatible, env-configured); a
   deterministic fallback works with no key. Questions outside the corpus are stated as
   out-of-corpus rather than guessed at.

3. **Training Centre.** Short THRIVE-authored practice modules with persistent progress,
   plus verified links to DIKSHA, NISHTHA and the NEP 2020 policy. Explicitly a
   **learning record**, not an official certificate.

4. **Verified Education Updates.** Curated, source-linked official resources and policy
   updates with search, categories and bookmarks. No live circulars, no fabricated news.

5. **Teacher Community.** Peer discussion threads with replies, helpful reactions,
   bookmarks, reporting and a moderation threshold.

**Plus:** WhatsApp as a second front door. Teachers can message the THRIVE test number and
get the same sourced assistant answers from a phone, using Meta's WhatsApp Business Cloud
API (signature-verified webhook, message dedup).

### How it was built

- **Frontend** — Next.js 13 (Pages Router), TypeScript, Tailwind, custom design system.
  All `/api/*` traffic proxies through `pages/api/[...proxy].ts` to the backend.
- **Backend** — FastAPI, SQLAlchemy, JWT auth; a deterministic constraint-solving compiler
  (not an LLM) for the flagship; retrieval-grounded assistant with a local embedding-free
  matcher over the curriculum corpus.
- **Agentic integration** — the compiler and the assistant are the two agentic surfaces:
  one plans and enforces constraints, the other grounds and cites. Neither is allowed to
  guess; both explain refusal.
- **Deployment** — Vercel for the frontend, Fly.io for the backend (Dockerfile that ships
  the curriculum corpus into the image).

### Honest limits

- Seeded curriculum coverage is **Grades 1–5 core chapters, Mathematics and EVS, aligned to
  NCERT structure**. It is illustrative seed data, not validated Bihar SCERT or pan-India
  board coverage.
- The product does not claim any user counts, school partnerships, endorsements or measured
  learning improvements.
- The Training Centre modules are **not** official certifications.
- THRIVE does **not** claim endorsement or partnership with NCERT, DIKSHA, NISHTHA, the
  Ministry of Education, SCERTs or the **Azim Premji Foundation**. The Azim Premji
  Foundation is named only as a *potential* future collaborator on teacher training
  content; no contact, agreement or endorsement exists.
- WhatsApp inbound currently requires the Meta webhook to be registered (§8).

### Links

- Live: https://thrive-2026-nine.vercel.app
- Repository: https://github.com/aakritiieee7/THRIVE-2026
- Demo video: `THRIVE_DEMO.mp4` in the repository root

*(end of issue body)*

---

## 3. Verified test results

| Check | Result |
|---|---|
| Backend pytest suite | **58 passed, 0 failed** (`THRIVE_SKIP_DOTENV=1 python -m pytest tests/ -q`) |
| Same suite without the skip flag, with a real `.env` present | 6 fail — a test-isolation issue in the local `.env`, not a product defect (details in `THRIVE_FINAL_TEST_REPORT.md` §1) |
| `npx tsc --noEmit` | clean |
| `npm run build` | succeeded, 15 routes |
| Live landing page | 200 |
| Live assistant status through the proxy | 200, `live: true`, `signing: true` |
| Live assistant, English curriculum question | 200, 3 sources |
| Live assistant, out-of-corpus question | 200, explicit out-of-corpus reply |
| Live assistant, Hindi reply language | 200, Devanagari reply |

Full detail: `THRIVE_FINAL_TEST_REPORT.md`, `THRIVE_DEPLOYMENT_VERIFICATION.md`.

---

## 4. Demo video

| File | What it is |
|---|---|
| `THRIVE_DEMO.mp4` | 1920×1080, 30 fps, 2 m 50.6 s, H.264 + AAC stereo. Narrated by an Indian English female voice (Microsoft `en-IN-NeerjaNeural`), with a quiet ambient bed under it, burned-in captions, a branded title card, top-left scene labels and a closing card. |
| `THRIVE_VOICEOVER.mp3` | Narration-only track, 2 m 50.6 s, for anyone re-cutting the video. |
| `THRIVE_SUBTITLES.srt` | 36 synchronised cues for the whole video. |
| `THRIVE_VOICEOVER.md` | The exact spoken script, with a claim-by-claim evidence table. |
| `THRIVE_DEMO_SCRIPT.md` | The human-readable beat sheet for a live walkthrough. |
| `THRIVE_DEMO_SHOTLIST.md` | Scene → timestamp → frame → caption mapping. |

The video shows the product only with seeded demo data. No account passwords, API keys,
personal notifications or private user data appear in it.

---

## 5. Verified deployment facts

- Frontend responds in ~0.12 s.
- Backend reachable through the Vercel proxy; WhatsApp credentials are live, signature
  verification is on.
- The deployed assistant returns **real curriculum sources** (the earlier deployment
  returned a placeholder because the Docker image lacked the corpus — fixed).

Details: `THRIVE_DEPLOYMENT_VERIFICATION.md`.

---

## 6. File map (what was produced this session)

| File | Purpose |
|---|---|
| `THRIVE_FINAL_SUBMISSION.md` | This pack |
| `THRIVE_DEMO_SCRIPT.md` | Beat-by-beat demo script |
| `THRIVE_VOICEOVER.md` | Exact narration text + claim evidence |
| `THRIVE_DEMO_SHOTLIST.md` | Timeline / shot list |
| `THRIVE_DEPLOYMENT_VERIFICATION.md` | Live deployment checks |
| `THRIVE_FINAL_TEST_REPORT.md` | Test results and what was not tested |
| `THRIVE_DEMO.mp4` | The narrated demo video |
| `THRIVE_VOICEOVER.mp3` | The narration track |
| `THRIVE_SUBTITLES.srt` | Subtitles |
| `demo_build/` | Reproducible build scripts (`tts.py`, `render_assets.py`, `build_video.py`, `narration.py`) and their intermediate assets |
| `demo_frames/` | The product screenshots used as scene stills, plus `check/` verification frames |

`demo_build/` and `demo_frames/` hold build intermediates. They are untracked; commit them
only if you want the video to be rebuildable from the repository (the three scripts are
small; the audio, captions and clips folders are not).

---

## 7. Exact Git commands (you run these)

From the repository root, with `backend/Dockerfile` already modified:

```bash
git status
```

```bash
git checkout -b submission/final
```

Stage the Dockerfile fix — **this is the fix that makes the deployed assistant cite real sources** — and the deliverables:

```bash
git add backend/Dockerfile THRIVE_DEMO.mp4 THRIVE_VOICEOVER.mp3 THRIVE_SUBTITLES.srt THRIVE_VOICEOVER.md THRIVE_DEMO_SCRIPT.md THRIVE_DEMO_SHOTLIST.md THRIVE_FINAL_SUBMISSION.md THRIVE_DEPLOYMENT_VERIFICATION.md THRIVE_FINAL_TEST_REPORT.md
```

Commit:

```bash
git commit -m "fix: ship curriculum corpus into the backend image; add demo video and submission pack

The assistant resolves its grounding corpus as <app>/../../curriculum, which is
/curriculum inside the container. The image did not copy it, so the deployed
assistant fell back to generic guidance with a placeholder source. COPY
curriculum /curriculum fixes that; the live assistant now returns three real
sources per reply.

Also adds the narrated 2m50s demo video with subtitles, the voiceover track,
the demo script / shot list / voiceover text, and the deployment and test
reports.

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

Push:

```bash
git push -u origin submission/final
```

Then open the pull request (or merge `submission/final` into `main` first if the repo judges `main`):

```bash
gh pr create --title "Submission: THRIVE demo video and final pack" --body "Deployment fix for the assistant corpus (Dockerfile), narrated demo video, subtitles, voiceover track, and submission reports. Tests: 58 backend tests pass with THRIVE_SKIP_DOTENV=1; tsc clean; production build succeeds."
```

Optional — commit the reproducible build scripts (skip the audio/clip intermediates):

```bash
git add demo_build/narration.py demo_build/tts.py demo_build/render_assets.py demo_build/build_video.py
git commit -m "chore: add demo video build scripts"
```

Then create the hackathon submission issue with the body in §2:

```bash
gh issue create --repo <org-or-user>/<hackathon-repo> --title "[Submission] THRIVE — Teacher Hub for Resources, Instruction, Verified Information & Empowerment" --body-file /tmp/thrive_submission_body.md
```

(First save §2's body — the part between "Issue body (copy from here)" and "(end of issue body)" — to `/tmp/thrive_submission_body.md`.)

---

## 8. Remaining external authorisations (only you can do these)

1. **Meta webhook registration** — WhatsApp → Configuration → Webhook.
   Callback URL = `https://thrive-2026-api.fly.dev/assistant/whatsapp`
   (confirm the exact origin with `flyctl info -a thrive-2026-api`), verify token =
   `WHATSAPP_VERIFY_TOKEN` on Fly, subscribe to `messages`. Until then, outbound works and
   inbound does not.
2. **Add your demo phone to the Meta recipient list** — API Setup → *To* → add the number
   you will demo from. Test numbers cannot message unlisted numbers.
3. **Fly card on file** — a free Fly machine can idle out (first request took ~4.5 s in
   testing). Add a card in the Fly dashboard to keep the backend warm during judging.
4. **Team and contact fields** in §1.
5. **Hackathon repository name** for the `gh issue create` command in §7.
6. **Confirm the submission instructions at https://codeforindia.org** — the deadline and
   required issue template may have been updated since this pack was written.

---

## 9. What was deliberately not done

- No commit, push, branch merge, pull request, issue, or submission — as you asked.
- No repository history changes; no destructive Git commands.
- No production data or database changes.
- No secrets, keys or credentials written anywhere in this pack.
- No invented users, schools, partnerships, endorsements or learning outcomes.
