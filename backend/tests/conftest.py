"""Shared test setup: point the app at an isolated SQLite database."""
import os

# Must run before app imports (api/test modules import app.main).
os.environ['DATABASE_URL'] = 'sqlite:///./test_thrive.db'
os.environ.setdefault('THRIVE_SECRET', 'test-secret')

# Stop app/__init__.py loading a developer's real .env. api.py reads
# WHATSAPP_* at module level, so inheriting live keys would make the
# unconfigured-behaviour tests fail and turn on HMAC webhook enforcement.
# Tests that exercise configured/live behaviour set these explicitly.
os.environ['THRIVE_SKIP_DOTENV'] = '1'
for _k in ('WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID', 'WHATSAPP_APP_SECRET'):
    os.environ.pop(_k, None)

# Remove leftovers from prior runs so each session starts clean.
_DB = os.path.join(os.path.dirname(__file__), '..', 'test_thrive.db')
if os.path.exists(_DB):
    os.remove(_DB)
