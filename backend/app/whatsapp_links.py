"""WhatsApp ↔ THRIVE account binding via one-time pairing codes.

The Meta webhook only ever tells us a sender id (the phone number). The only
binding that works without SMS OTP is: a signed-in teacher fetches a short
code from the web, and sends it from their own WhatsApp number. Redeeming the
code proves control of both the web session and the phone.

Rules enforced here (server-side, never by the client):

* one number ↔ one account, in both directions — a phone already linked to
  anybody is refused outright (rebinding happens from the web, not chat);
* codes are 8 characters from an unambiguous alphabet (no 0/O/1/I), live for
  10 minutes, are single-use, and only their SHA-256 hash is stored;
* issuing a new code retires the teacher's older unused codes;
* if the teacher already has a link on another number, redeeming moves it —
  the reply then says the previous number was unlinked;
* nothing here ever reads teacher profile data — callers decide what to show.

This module only touches its own tables; no API or assistant imports it.
"""
import calendar
import hashlib
import secrets
import time
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .db import now
from .models import Teacher, WhatsAppLink, WhatsAppPairing

# 8 chars, alphabet without 0/O/1/I — unambiguous over a voice/typed chat.
CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
CODE_LENGTH = 8
CODE_TTL_SECONDS = 10 * 60


def normalize_phone(raw: Any) -> str:
    """Reduce a sender id to comparable digits ('+91 98765-43210' → '919876543210').

    Meta delivers bare digits; test harnesses and humans often include '+',
    spaces or dashes. Everything non-digit is dropped.
    """
    return ''.join(ch for ch in str(raw or '') if ch.isdigit())


def _epoch(ts: str) -> float:
    """Parse the db.now() UTC format to epoch seconds; 0 when unparseable.

    The timestamp is UTC (trailing Z) — use gmtime, not mktime, which would
    treat it as local time. On a non-UTC machine that shift made a fresh
    10-minute code read as hours old and expire immediately.
    """
    try:
        return float(calendar.timegm(time.strptime(ts, '%Y-%m-%dT%H:%M:%SZ')))
    except (ValueError, TypeError):
        return 0.0


def phone_masked(phone: str) -> str:
    """Show only the last four digits: '919876543210' → '…43210'."""
    digits = normalize_phone(phone)
    if len(digits) <= 4:
        return digits
    return '…' + digits[-4:]


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode('utf-8')).hexdigest()


def issue_code(teacher: Teacher, db: Session) -> Dict[str, Any]:
    """Create a fresh one-time link code for this teacher.

    Older unused codes for the same teacher are dropped first, so a leaked
    previous code stops working the moment a new one is fetched.
    Returns {code, expires_at, expires_in} — the plain code is returned once
    and never persisted (only its hash is).
    """
    db.query(WhatsAppPairing).filter(
        WhatsAppPairing.teacher_id == teacher.id,
        WhatsAppPairing.used_at.is_(None),
    ).delete(synchronize_session=False)

    code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
    expires_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + CODE_TTL_SECONDS))
    db.add(WhatsAppPairing(teacher_id=teacher.id, code_hash=_hash_code(code),
                           expires_at=expires_at, used_at=None, created_at=now()))
    db.commit()
    return {'code': code, 'expires_at': expires_at, 'expires_in': CODE_TTL_SECONDS}


def redeem(phone_raw: Any, message: str, db: Session) -> Dict[str, Any]:
    """Try to bind a sender to an account by redeeming the code they sent.

    Returns {'ok', 'teacher', 'reason', 'relinked'}:
      ok=True, teacher set           — bound (possibly moving an old number)
      ok=False, reason set           — refused; reason is a plain sentence the
                                       caller may translate/paraphrase
    The reason strings are intentionally factual (they name accounts by
    display name only) and are safe to surface after translation.
    """
    phone = normalize_phone(phone_raw)
    if not phone:
        return {'ok': False, 'teacher': None, 'relinked': False,
                'reason': 'no-phone'}

    # Extract the code from "link ABCD2345" / "connect ABCD2345" / bare code.
    tokens = str(message or '').replace(':', ' ').split()
    code = ''
    for tok in tokens:
        stripped = ''.join(ch for ch in tok.upper() if ch.isalnum())
        # Membership (each char in the alphabet), not substring — `stripped in
        # CODE_ALPHABET` would test the whole code as a contiguous run, which a
        # random code is not, and silently rejected every real code.
        if len(stripped) == CODE_LENGTH and all(ch in CODE_ALPHABET for ch in stripped):
            code = stripped
    if not code:
        return {'ok': False, 'teacher': None, 'relinked': False, 'reason': 'no-code'}

    # Phone already bound to an account? Never silently re-point it.
    existing = db.query(WhatsAppLink).filter(WhatsAppLink.phone == phone).first()
    if existing is not None:
        owner = db.get(Teacher, existing.teacher_id)
        return {'ok': False, 'teacher': None, 'relinked': False,
                'reason': 'phone-taken', 'owner_name': owner.name if owner else 'another account'}

    row = (db.query(WhatsAppPairing)
              .filter(WhatsAppPairing.code_hash == _hash_code(code),
                      WhatsAppPairing.used_at.is_(None))
              .first())
    if row is None:
        return {'ok': False, 'teacher': None, 'relinked': False, 'reason': 'bad-code'}

    if _epoch(row.expires_at) < time.time():
        return {'ok': False, 'teacher': None, 'relinked': False, 'reason': 'expired'}

    teacher = db.get(Teacher, row.teacher_id)
    if teacher is None:
        return {'ok': False, 'teacher': None, 'relinked': False, 'reason': 'bad-code'}

    row.used_at = now()

    # Teacher is moving numbers: drop the previous binding for this account.
    old = db.query(WhatsAppLink).filter(WhatsAppLink.teacher_id == teacher.id).first()
    relinked = False
    if old is not None:
        if old.phone == phone:
            db.commit()
            return {'ok': True, 'teacher': teacher, 'relinked': False, 'reason': 'already'}
        db.delete(old)
        relinked = True

    db.add(WhatsAppLink(teacher_id=teacher.id, phone=phone, linked_at=now()))
    db.commit()
    return {'ok': True, 'teacher': teacher, 'relinked': relinked, 'reason': 'ok'}


def resolve_teacher(phone_raw: Any, db: Session) -> Optional[Teacher]:
    """Look up the account bound to this sender id, if any."""
    phone = normalize_phone(phone_raw)
    if not phone:
        return None
    link = db.query(WhatsAppLink).filter(WhatsAppLink.phone == phone).first()
    if link is None:
        return None
    return db.get(Teacher, link.teacher_id)


def get_link(teacher_id: int, db: Session) -> Optional[WhatsAppLink]:
    return db.query(WhatsAppLink).filter(WhatsAppLink.teacher_id == teacher_id).first()


def remove_link(teacher_id: int, db: Session) -> bool:
    """Unbind this account's number. Only ever called from the signed-in web."""
    link = get_link(teacher_id, db)
    if link is None:
        return False
    db.delete(link)
    db.commit()
    return True
