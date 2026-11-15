# THRIVE — Deployment Verification Report

**Date:** 15 November 2026
**Frontend:** https://thrive-2026-nine.vercel.app (Vercel)
**Backend:** FastAPI on Fly.io (`thrive-2026-api`, region `sin`), reached through the Next.js
proxy at `/api/[...proxy]`
**Repository:** https://github.com/aakritiieee7/THRIVE-2026

All checks below were run live against the deployed URLs, from a clean shell, on the date
above. Nothing here is inferred.

---

## 1. Frontend

| Check | Result |
|---|---|
| `GET https://thrive-2026-nine.vercel.app/` | **200** in 0.12 s |
| Production build (`npm run build`) | **Succeeded** — all 15 routes compiled (see §4) |
| TypeScript check (`npx tsc --noEmit`) | **Clean** |

## 2. Backend reachability through the proxy

The frontend does not call Fly directly; every API call goes through
`/api/[...proxy]` → `BACKEND_URL`. `BACKEND_URL` is a server-side Vercel env var and is
**required**; if it is missing every `/api/*` call returns 502.

| Check | Result |
|---|---|
| `GET /api/assistant/whatsapp/status` | **200** |

```json
{
  "configured": true, "live": true, "channel": "whatsapp",
  "webhook_path": "/assistant/whatsapp",
  "verify_token_set": true, "signing": true,
  "wa_number": "+1 555-155-4744",
  "linked_senders": 0,
  "mode": "live-send"
}
```

This confirms: the backend is up behind the proxy, Meta WhatsApp credentials are
configured, the verify token is set, HMAC signature verification is on, and live
sends are enabled via the Meta Cloud API.

## 3. Teaching Assistant (retrieval grounding)

| Request | Result |
|---|---|
| `POST /api/assistant/ask` — `{"message":"How do I explain evaporation with chalk and a blackboard?"}` | 200; reply returned; **3 sources**; `mode: local-grounded` |
| `POST /api/assistant/ask` — Hindi Devanagari question about evaporation | 200; **honest out-of-corpus reply** ("I do not have a verified source in THRIVE's current curriculum corpus for that question…") with 1 guidance source |
| `POST /api/assistant/ask` — same English question, `language: "hi"` | 200; reply returned **in Hindi (Devanagari)** |

Two things matter here:

1. **Grounding is real.** The deployed build returns curriculum answers with three
   distinct corpus sources. An earlier deployment returned one placeholder source
   because the Docker image did not include the corpus; that is fixed by
   `COPY curriculum /curriculum` in `backend/Dockerfile` (currently uncommitted — see §6).
2. **It does not fabricate.** A question the corpus cannot cover gets an explicit
   out-of-corpus answer, not an invented one. The Hindi reply-language switch works on
   the deployed instance.

## 4. Production build output

`npm run build` in `frontend/` (Next.js Pages Router) produced:

| Route | Type | Size |
|---|---|---|
| `/` | static | |
| `/api/[...proxy]` | server (λ) | 75.2 kB |
| `/assistant` | static | 101 kB |
| `/chat` | static | 92.8 kB |
| `/community` | static | 89.6 kB |
| `/compiler` | static | 96.9 kB |
| `/demo` | static | 87.9 kB |
| `/guided` | static | 96.4 kB |
| `/landing` | static | 85.6 kB |
| `/login` | static | 85.1 kB |
| `/profile` | static | 90.4 kB |
| `/resources` | static | 89.4 kB |
| `/signup` | static | 87.8 kB |
| `/training` | static | 93.2 kB |
| `/try` | static | 91.9 kB |
| `/updates` | static | 88 kB |

Shared first-load JS: 86.3 kB.

## 5. WhatsApp integration

| Item | Status |
|---|---|
| Test number | +1 (555) 155-4744 (Meta test number) |
| Phone Number ID | 1388722394333360 |
| Messaging account ID | 1456350503301632 |
| Backend webhook path | `/assistant/whatsapp` — **no `/api` prefix** |
| Signature verification | `X-Hub-Signature-256` HMAC — enabled |
| Duplicate-message handling | 10-minute message-id dedup — implemented |
| `/demo` QR page | Reads `/api/assistant/whatsapp/qr` and the status above — live |

**Still needed from you (external authorisation):**

1. **Register the webhook in Meta** — WhatsApp → Configuration → Webhook:
   - Callback URL: the Fly app's origin + `/assistant/whatsapp`
   - Verify token: the value of `WHATSAPP_VERIFY_TOKEN` on Fly
   - Subscribe to the `messages` field.
   Until this is done, outbound sends work but inbound teacher messages will not arrive.
2. **Add your demo phone to the recipient list** — Meta test numbers can only message
   numbers you have added under *API Setup → To*. Add the phone you will demo from.

## 6. Uncommitted change in this repo

`backend/Dockerfile` has an uncommitted edit adding `COPY curriculum /curriculum`. That
line is what makes the deployed assistant return real sources. **The deployed image was
built and pushed with this change**; the source change still needs committing by you
(commands in `THRIVE_FINAL_SUBMISSION.md` §7).

## 7. Known limits of the deployment

- **Fly free machine can sleep.** If the backend idles out, the first request takes
  several seconds (observed ~4.5 s on the status call). Keeping a card on file with Fly
  keeps the machine awake; see `THRIVE_FINAL_SUBMISSION.md` §8.
- **Database on Fly.** `DATABASE_URL` is not pinned by `fly.toml`, so the backend falls
  back to its SQLite default on the machine. It survives restarts only as far as the
  Fly volume allows, and is not designed for concurrent load — fine for demo and judging.
- **No live LLM key deployed by default.** The deterministic grounded fallback answers
  every request; if `LLM_API_KEY` is set on Fly, the assistant composes from the same
  retrieved sources.
