# THRIVE - Final Test Report

**Date:** 15 November 2026
**Commit under test:** `a3b4168` plus the uncommitted `backend/Dockerfile` change
(`COPY curriculum /curriculum`)

## 1. Backend test suite - 58 passed, 0 failed

```
$ cd backend && THRIVE_SKIP_DOTENV=1 .venv/bin/python -m pytest tests/ -q
..........................................................        [100%]
58 passed in 2.65s
```

### About `THRIVE_SKIP_DOTENV=1`

The suite sets `THRIVE_SKIP_DOTENV=1` in `backend/tests/conftest.py`. Without it,
`app/__init__.py` loads the developer's real `.env`, which contains live `WHATSAPP_*`
keys; `api.py` reads those at import time, so the tests that assert *unconfigured*
behaviour fail. **With a real `.env` present and no skip flag, 6 tests fail; with the
flag, 58/58 pass.** This is a test-isolation property, not a product defect. On CI or a
clean machine with no `.env`, the flag makes no difference.

### What the suite covers

| Area | Coverage |
|---|---|
| Compiler solver | feasibility rejection, exact minute accounting, teacher double-booking, independent-work assignment, shared-group handling, CSV/printable export |
| Auth & ownership | signup, login, JWT, plans scoped to their owner |
| Plan CRUD | create, read, update, delete, per-section regeneration |
| Training Centre | modules, progress persistence |
| Updates | bookmarks |
| Community | posts, replies, helpful votes, moderation threshold |
| Assistant | grounded round-trip on an isolated SQLite database, sources present |

## 2. Frontend type check - clean

```
$ cd frontend && npx tsc --noEmit
$ echo $?
0
```

## 3. Production build - succeeded

```
$ cd frontend && npm run build
✓ all 15 routes compiled (see THRIVE_DEPLOYMENT_VERIFICATION.md §4)
```

## 4. Deployed end-to-end checks - all passed

Run against https://thrive-2026-nine.vercel.app:

| Check | Result |
|---|---|
| Landing page loads | 200 |
| `/api/assistant/whatsapp/status` through the proxy | 200, `live: true`, `signing: true` |
| Assistant answers a curriculum question with real sources | 200, 3 sources |
| Assistant declines out-of-corpus questions honestly | 200, explicit out-of-corpus reply |
| Assistant replies in Hindi (Devanagari) | 200 |

## 5. Demo assets - verified with ffprobe / ffmpeg

| Asset | Verification |
|---|---|
| `media/THRIVE_DEMO.mp4` | h264 1920×1080, 30 fps; aac 48 kHz stereo; **170.63 s**; 7,425,212 bytes; `volumedetect` mean −19.8 dB, max −4.4 dB |
| `THRIVE_VOICEOVER.mp3` | 170.58 s; 192 kbps, 48 kHz, stereo; 4,095,404 bytes |
| `THRIVE_SUBTITLES.srt` | 36 cues; first at 00:00:07,275, last ends 00:02:49,576 |
| Visual check | 10 frames pulled from the **final MP4** at 3, 12, 34, 51, 80, 100, 121, 149, 160, 167 s - every one shows the expected card/screen, scene label and a legible caption |

## 6. What was not tested

- **Inbound WhatsApp messages end to end** - the Meta webhook has not been registered
 yet (§5 of the deployment report). Outbound path and webhook handler are built and
 unit-tested; the live round trip cannot be confirmed until the webhook is registered.
- **Load, concurrency and long-running uptime** - not exercised.
- **Browsers other than Chromium / Safari-family engines** - not exercised.
- **Hindi Devanagari in the UI** - the assistant's Hindi replies were confirmed via the
 API; the rendered UI text was not visually inspected this session.
