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


def _add_missing_columns() -> None:
    """Add columns introduced after a table was first created (SQLite dev DBs).

    There are no Alembic migrations in this project, so a pre-existing
    thrive.db would otherwise lack newer columns (e.g. lesson_plans.guest_token,
    community_posts.helpful). Production deployments should still adopt
    Alembic for real migrations.
    """
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    try:
        existing = {t for t in inspector.get_table_names()}
        for table in Base.metadata.sorted_tables:
            if table.name not in existing:
                continue
            # community_helpful arrives with the helpful-votes feature; its
            # parent table exists on older dev DBs but the table may not.
            if table.name == 'community_helpful':
                Base.metadata.create_all(bind=engine, tables=[table])
                continue
            have = {c['name'] for c in inspector.get_columns(table.name)}
            with engine.begin() as conn:
                for col in table.columns:
                    if col.name in have:
                        continue
                    col_type = col.type.compile(engine.dialect)
                    nullable = 'NULL' if col.nullable else 'NOT NULL DEFAULT 0'
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col_type} {nullable}'))
                    if col.index:
                        conn.execute(text(f'CREATE INDEX IF NOT EXISTS ix_{table.name}_{col.name} '
                                          f'ON {table.name} ({col.name})'))
            # Relax NOT NULL where the model now allows NULL (e.g. guest plans).
            for col in table.columns:
                if col.name in have and col.nullable and col.name == 'teacher_id':
                    try:
                        conn.execute(text(f'ALTER TABLE {table.name} ALTER COLUMN '
                                          f'{col.name} DROP NOT NULL'))
                    except Exception:
                        pass
    except Exception:
        # Never block startup on a best-effort dev migration; the next
        # create_all still guarantees fresh databases are correct.
        pass


def init_db() -> None:
    """Create tables if they do not exist yet (dev/self-host friendly).

    Production deployments should replace this with Alembic migrations;
    alembic.ini ships in this service for that migration.
    """
    from . import models  # noqa: F401  (register mappings)
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
