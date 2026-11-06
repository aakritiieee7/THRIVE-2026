import os
import time

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_SQLITE = 'sqlite:///./thrive.db'
DATABASE_URL = os.environ.get('DATABASE_URL', '').strip() or DEFAULT_SQLITE

# Postgres needs a pool that survives restarts; SQLite works best with a
# single connection so checkouts never deadlock inside one process.
connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True, future=True)

if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def _set_sqlite_pragma(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        cur.execute('PRAGMA foreign_keys=ON')
        cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()


def get_db():
    """FastAPI dependency yielding a scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables if they do not exist yet (dev/self-host friendly).

    Production deployments should replace this with Alembic migrations;
    alembic.ini ships in this service for that migration.
    """
    from . import models  # noqa: F401  (register mappings)
    Base.metadata.create_all(bind=engine)


def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
