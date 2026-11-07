"""Guest (anonymous) access layer.

Teachers can explore THRIVE without an account. Guests get:

  • a short-lived, unverified JSON token (``guest-<random>``) — it carries no
    identity and never grants access to an account, only to guest-scoped
    endpoints (guest asks and guest plan drafts),
  • a per-process rate limit (GUEST_ASK_PER_HOUR, default 20) on assistant
    asks, so anonymous traffic stays bounded,
  • server-side storage for a small number of unsynced lesson plans
    (GUEST_PLAN_LIMIT, default 5) keyed by the token.

The token is deliberately NOT a JWT: there is no account to claim. When a
guest registers, the client calls /auth/guest/upgrade with the guest token
and the new account token, and the stored drafts are adopted into the
teacher's account (and the guest token retired).

Abuse protection: per-IP token-minting is capped (GUEST_MINTS_PER_HOUR,
default 20) so an attacker cannot endlessly rotate around the ask limit.
All limits are env-configurable. Nothing here touches teacher data.
"""
import os
import secrets
import time

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .db import get_db, now
from .models import LessonPlan
from .schemas import GuestAskIn, GuestPlanOut, GuestTokenOut, LessonPlanIn

GUEST_TTL_HOURS = float(os.environ.get('GUEST_TTL_HOURS', '12'))
GUEST_ASK_PER_HOUR = int(os.environ.get('GUEST_ASK_PER_HOUR', '20'))
GUEST_PLAN_LIMIT = int(os.environ.get('GUEST_PLAN_LIMIT', '5'))
GUEST_MINTS_PER_HOUR = int(os.environ.get('GUEST_MINTS_PER_HOUR', '20'))
GUEST_PLAN_MAX_AGE_DAYS = int(os.environ.get('GUEST_PLAN_MAX_AGE_DAYS', '7'))

# In-process counters (single worker dev/deploy is the target shape; a
# multi-worker deployment should move these to Redis — see README).
_tokens: dict = {}      # token -> created_at (epoch)
_asks: list = []        # (token, epoch) ask timestamps
_mints: list = []       # (ip, epoch) token-mint timestamps


def _prune() -> None:
    cutoff = time.time() - 3600
    _asks[:] = [t for t in _asks if t[1] > cutoff]
    _mints[:] = [t for t in _mints if t[1] > cutoff]
    for tok in [t for t, ts in _tokens.items() if time.time() - ts > GUEST_TTL_HOURS * 3600]:
        del _tokens[tok]


def reset_state() -> None:
    """Clear in-memory counters (tests only)."""
    _tokens.clear()
    _asks.clear()
    _mints.clear()


def mint_token(ip: str) -> str:
    """Issue a guest token, honouring the per-IP mint cap."""
    _prune()
    ip = (ip or 'unknown')[:64]
    recent = sum(1 for (i, ts) in _mints if i == ip)
    if recent >= GUEST_MINTS_PER_HOUR:
        raise HTTPException(status_code=429, detail='Too many guest sessions started from this connection. '
                                'Please wait a while, or create a teacher account to continue.')
    _mints.append((ip, time.time()))
    tok = 'guest-' + secrets.token_urlsafe(24)
    _tokens[tok] = time.time()
    return tok


def check_token(token: str) -> None:
    if not token or token not in _tokens:
        raise HTTPException(status_code=401, detail='Guest session expired. Please continue as a guest again, '
                                'or sign in to keep your work.')


def count_asks(token: str) -> int:
    return sum(1 for (t, ts) in _asks if t == token and ts > time.time() - 3600)


def record_ask(token: str) -> None:
    _prune()
    _asks.append((token, time.time()))


def guest_asks_remaining(token: str) -> int:
    return max(0, GUEST_ASK_PER_HOUR - count_asks(token))


def list_guest_plans(token: str, db: Session) -> list[dict]:
    rows = db.query(LessonPlan)\
             .filter(LessonPlan.teacher_id.is_(None), LessonPlan.guest_token == token)\
             .order_by(LessonPlan.id.desc()).all()
    return [{'id': p.id, 'title': p.title, 'subject': p.subject, 'medium': p.medium,
             'board': p.board, 'minutes': p.minutes, 'payload': p.payload or {},
             'created_at': p.created_at} for p in rows]


def create_guest_plan(req: LessonPlanIn, token: str, db: Session) -> LessonPlan:
    existing = list_guest_plans(token, db)
    if len(existing) >= GUEST_PLAN_LIMIT:
        raise HTTPException(status_code=400,
                            detail=f'A guest session can keep up to {GUEST_PLAN_LIMIT} drafts. '
                                   'Create a free account to keep all of your plans, '
                                   'or remove a draft here.')
    plan = LessonPlan(teacher_id=None, guest_token=token, title=req.title, subject=req.subject,
                      medium=req.medium, board=req.board, minutes=req.minutes,
                      payload=req.payload, created_at=now())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def delete_guest_plan(token: str, plan_id: int, db: Session) -> None:
    plan = db.get(LessonPlan, plan_id)
    if plan is None or plan.teacher_id is not None or plan.guest_token != token:
        raise HTTPException(status_code=404, detail='Draft not found in this guest session.')
    db.delete(plan)
    db.commit()


def adopt_guest_plans(guest_token: str, teacher_id: int, db: Session) -> int:
    """Move a guest's drafts into a teacher account; retire the guest token."""
    rows = db.query(LessonPlan).filter(LessonPlan.teacher_id.is_(None),
                                       LessonPlan.guest_token == guest_token).all()
    for p in rows:
        p.teacher_id = teacher_id
        p.guest_token = None
    if guest_token in _tokens:
        del _tokens[guest_token]
    db.commit()
    return len(rows)


def purge_stale_guest_plans(db: Session) -> int:
    """Drop guest drafts older than GUEST_PLAN_MAX_AGE_DAYS (no account claimed them)."""
    cutoff = now()[:4] + '-' + time.strftime('%m-%d', time.gmtime(time.time() - GUEST_PLAN_MAX_AGE_DAYS * 86400))
    q = db.query(LessonPlan).filter(LessonPlan.teacher_id.is_(None),
                                    LessonPlan.guest_token.isnot(None))
    if cutoff[0].isdigit():
        q = q.filter(LessonPlan.created_at < cutoff)
    rows = q.all()
    for p in rows:
        db.delete(p)
    db.commit()
    return len(rows)


def plan_out(p: LessonPlan) -> dict:
    return GuestPlanOut(id=p.id, title=p.title, subject=p.subject, medium=p.medium,
                        board=p.board, minutes=p.minutes, payload=p.payload or {},
                        created_at=p.created_at)
