"""JWT-based authentication for teacher accounts.

Token: HS256, payload {sub: teacher_id, exp}. Secret comes from
THRIVE_SECRET (env) with a dev-only fallback so local runs work without
configuration — deployments must set THRIVE_SECRET.
"""
import os
import time
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .db import get_db
from .models import Teacher

ALGORITHM = 'HS256'
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days
DEV_SECRET = 'thrive-dev-secret-change-me'

_secret = os.environ.get('THRIVE_SECRET', '').strip() or DEV_SECRET
_pwd = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
_bearer = HTTPBearer(auto_error=False)


def secret() -> str:
    return _secret


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd.verify(plain, hashed)
    except ValueError:
        return False


def create_token(teacher_id: int) -> str:
    payload = {'sub': str(teacher_id), 'iat': int(time.time()), 'exp': int(time.time()) + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, _secret, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Teacher:
    if creds is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Not signed in')
    try:
        payload = jwt.decode(creds.credentials, _secret, algorithms=[ALGORITHM])
        teacher_id = int(payload.get('sub'))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired session')
    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Account no longer exists')
    return teacher


def get_optional_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[Teacher]:
    """Same as get_current_user but anonymous requests are allowed."""
    if creds is None:
        return None
    try:
        return get_current_user(creds, db)
    except HTTPException:
        return None
