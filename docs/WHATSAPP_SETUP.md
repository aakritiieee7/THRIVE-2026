# Connecting the THRIVE WhatsApp bot

THRIVE answers on WhatsApp through **Meta's WhatsApp Business Cloud API**.
A teacher messages the bot's number like any contact; replies are grounded in
the same curriculum corpus the web assistant uses, so web and WhatsApp give
identical sourced answers.

This guide covers: getting the keys, deploying, registering the webhook,
adding test recipients, testing locally with ngrok, and what to do if Meta
approval is slow.

---

## 0. What you need

| Thing | Where |
|---|---|
| A Meta developer account | https://developers.facebook.com |
| A Meta app (type: Business) | created in the steps below |
| A WhatsApp test number | free, provided by Meta — no SIM needed |
| A public HTTPS URL for the backend | Fly/Render/etc. (or ngrok locally) |

You do **not** need a real phone number to start: Meta gives every app a free
test number that can message up to 5 verified recipients.

---

## 1. Get the five values

In **developers.facebook.com → your app → WhatsApp → API Setup**:

| Env var | Where it is on that page | Looks like |
|---|---|---|
| `WHATSAPP_PHONE_ID` | "Phone Number ID" | `1388722394333360` |
| `WHATSAPP_TOKEN` | the access token (click **Generate token**) | `EAAWQ…` (long string) |
| `WHATSAPP_DISPLAY_NUMBER` | the test number itself | `+1 555-155-4744` |
| `WHATSAPP_VERIFY_TOKEN` | **you invent this** | e.g. `thrive-verify` |
| `WHATSAPP_APP_SECRET` | App settings → Basic → App secret → **Show** | 32 hex chars |

> **Copy the token exactly.** It is ~300+ characters and easy to truncate
> when copying from a screenshot. A truncated token fails with
> `{"error":{"code":190,"message":"The access token could not be decrypted"}}`.
> Verify it immediately (step 2) rather than discovering it during a demo.

### The token expires

Meta's default token on the API Setup page is **temporary (24 hours)**. It is
fine for a demo, but for anything longer create a **System User** token:

1. Business settings → **Users → System users → Add**
2. Give it the `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions
3. Generate a token with **no expiry**, and use that as `WHATSAPP_TOKEN`

---

## 2. Verify the token before anything else

```bash
curl -s "https://graph.facebook.com/v19.0/$WHATSAPP_PHONE_ID?fields=display_phone_number,verified_name" \
  -H "Authorization: Bearer $WHATSAPP_TOKEN"
```

A working token returns:

```json
{"display_phone_number":"+1 555-155-4744","verified_name":"Test Number","id":"1388722394333360"}
```

Anything else — 401, `code: 190` — means the token is wrong or truncated.
Fix that first; every later step depends on it.

---

## 3. Put the values on the backend

They must reach **the FastAPI backend**, not the Next.js frontend. On Fly:

```bash
fly secrets set --app <your-app> \
  WHATSAPP_TOKEN=... \
  WHATSAPP_PHONE_ID=... \
  WHATSAPP_APP_SECRET=... \
  WHATSAPP_VERIFY_TOKEN=thrive-verify \
  WHATSAPP_DISPLAY_NUMBER="+1 555-155-4744"
fly deploy
```

Locally, put them in the repo-root `.env` (gitignored — never commit it).

Check:

```bash
curl -s https://<backend-host>/assistant/whatsapp/status
```

Expect `"live": true`, `"signing": true`, `"mode": "live-send"`.
If `live` is false the backend did not receive the token/phone id.

---

## 4. Register the webhook with Meta

Meta must know where to deliver messages.

1. **WhatsApp → Configuration → Webhook → Edit**
2. **Callback URL:** `https://<backend-host>/assistant/whatsapp`
   > Note there is **no `/api` prefix** — Next's `/api/*` proxy is only for
   > the browser. Meta calls the backend directly.
3. **Verify token:** the same string you put in `WHATSAPP_VERIFY_TOKEN`
4. Click **Verify and save** — Meta sends `GET ?hub.mode=subscribe…` and
   expects your token echoed back. A failure here means the two values differ.
5. Under **Webhook fields**, subscribe to **`messages`**.

Sends still work before this step; only *receiving* needs it.

---

## 5. Add recipient numbers (test mode)

A test number can only message numbers you have verified:

**API Setup → "To" dropdown → Manage phone number list → Add phone number**
→ receive an OTP in WhatsApp → enter it.

Without this, sending to a new number fails with
`(#131030) Recipient phone number not in allowed list`.

During the 24-hour *customer service window*, you can reply freely to anyone
who messaged you first. Outside it, Meta requires a pre-approved template
message to start a conversation.

---

## 6. Local testing with ngrok

```bash
# 1. Backend
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Tunnel
ngrok http 8000
# -> https://ab12-49-36-x-x.ngrok-free.app
```

Register `https://<ngrok-host>/assistant/whatsapp` as the Callback URL
(step 4) and send a message from a verified number.

ngrok's free URL changes on every restart, so you must re-verify the webhook
each time. A paid static domain avoids that.

Trigger an exchange without a phone at all:

```bash
python - <<'PY'
import json, hmac, hashlib, urllib.request
secret = open('.env').read().split('WHATSAPP_APP_SECRET=')[1].split()[0]
body = json.dumps({'entry':[{'changes':[{'value':{'messages':[
  {'id':'wamid.TEST1','from':'+919876543210','text':{'body':'help'}}]}}]}]}).encode()
sig = 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
r = urllib.request.Request('http://127.0.0.1:8000/assistant/whatsapp',
      data=body, headers={'content-type':'application/json','x-hub-signature-256':sig})
print(json.load(urllib.request.urlopen(r))['kind'])
PY
```

Then open `/demo` in the app — the exchange appears in the conversation log.

---

## 7. How the bot behaves

| You send | THRIVE does |
|---|---|
| `help` / `menu` | commands and what it can do |
| a teaching question | grounded, sourced answer in your language |
| `plan: Grade 2, 3 and 4, 40 minutes, maths` | a compiled multi-grade schedule |
| `post: …` | posts an update to your account |
| `progress 2 1` | marks training progress |
| `remind: …` | sets a reminder |
| `link ABCDEFGH` | binds this number to your web account |
| a voice note | downloads, transcribes, answers in the same language |

**Safety rules that are enforced, not just intended:**
- A number that is not linked gets *guest* answers and **cannot write** to any
  account — no plans, posts or progress changes.
- Replies stay inside teaching scope and keep the "check against your
  official syllabus" disclaimer.
- Student names are never requested or stored.

---

## 8. If Meta approval is slow — Twilio fallback

Meta's production number approval can take days. For a demo you can fall back
to Twilio's WhatsApp Sandbox, which requires only a join code.

The adapter sits behind the same interface as the Meta client, so the reply
logic is unchanged:

1. Twilio console → **Messaging → Try it out → Send a WhatsApp message**
2. Join the sandbox from your phone with the given code
3. Set the sandbox's *When a message comes in* webhook to
   `https://<backend-host>/assistant/whatsapp/twilio`
4. Set `TWILIO_AUTH_TOKEN` on the backend

> Twilio delivers form-encoded bodies, not Meta's JSON envelope, and signs
> with `X-Twilio-Signature` instead of `X-Hub-Signature-256`. The adapter
> translates both before handing the message to the same command router, so
> behaviour, grounding and safety rules are identical.

---

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `code: 190` access token could not be decrypted | token truncated on copy | re-copy the full token (step 2) |
| `#131030` recipient not in allowed list | number not verified | add it in API Management (step 5) |
| Webhook "verify and save" fails | `WHATSAPP_VERIFY_TOKEN` differs from what you typed in Meta | make them identical |
| `status.signing` is false | `WHATSAPP_APP_SECRET` not set | set it; unsigned calls will otherwise be accepted |
| Webhook 403 invalid signature | secret mismatch, or a proxy rewrote the body | set the same app secret; ensure nothing re-encodes the request body |
| Duplicate replies | Meta retried a slow response | already handled — message ids are remembered for 10 minutes |
| `/demo` shows "No WhatsApp messages yet" | webhook not registered, or field not subscribed | step 4, subscribe to `messages` |
| `/demo` 502 | Vercel has no `BACKEND_URL` | set it to the backend origin and redeploy |

---

## 10. Before a live demo

- [ ] `curl …/assistant/whatsapp/status` → `live: true`, `signing: true`
- [ ] Token not expired (temporary tokens last 24 h)
- [ ] Webhook verified, `messages` subscribed
- [ ] Demo phone added to the recipient list
- [ ] Send one `help` from that phone and watch it appear on `/demo`
- [ ] `BACKEND_URL` set on Vercel (or the frontend cannot reach the backend)
- [ ] Reminder: if the backend runs on a trial machine, keep it awake
