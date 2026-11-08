"""In-process rate limiting for the open (no-account) assistant endpoints.

The signed-in chat endpoint is naturally bounded per account, but
``/assistant/ask``, ``/assistant/bridge`` and the WhatsApp webhook are public,
so an attacker could otherwise grind the LLM/assistant with unbounded traffic.

This keeps the same shape as ``guest.py``: a per-key rolling one-hour window,
all limits env-configurable, in-memory (single-worker dev/deploy is the target
shape; a multi-worker deployment should move these to Redis — see README).

Keys are the client IP for the open web endpoints and the WhatsApp sender id
for the webhook, so a single teacher's phone or a single browser connection is
bounded, while distinct teachers are not throttled together.
"""
import os
import time

from fastapi import HTTPException

# Public assistant asks (web /ask + /bridge), per IP, per hour.
ASK_PER_HOUR = int(os.environ.get('THRIVE_PUBLIC_ASK_PER_HOUR', '30'))
# Inbound WhatsApp messages, per sender, per hour.
WHATSAPP_PER_HOUR = int(os.environ.get('THRIVE_WHATSAPP_PER_HOUR', '60'))

_events: dict[str, list] = {}   # key -> [epoch, epoch, ...] within the window


def _prune(key: str) -> list:
    cutoff = time.time() - 3600
    _events[key] = [t for t in _events.get(key, []) if t > cutoff]
    return _events[key]


def allow(key: str, limit: int, what: str = 'requests') -> None:
    """Record one event for ``key``; raise 429 when the hourly window is full."""
    events = _prune(key or 'unknown')
    if len(events) >= limit:
        raise HTTPException(
            status_code=429,
            detail=f'Too many {what} in the last hour. Please wait a little while, '
                   'or sign in to a teacher account for unlimited use.')
    events.append(time.time())
    _events[key] = events


def reset_state() -> None:
    """Clear in-memory counters (tests only)."""
    _events.clear()
