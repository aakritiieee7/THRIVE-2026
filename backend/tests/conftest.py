"""Shared test setup: point the app at an isolated SQLite database."""
import os

# Must run before app imports (api/test modules import app.main).
os.environ['DATABASE_URL'] = 'sqlite:///./test_thrive.db'
os.environ.setdefault('THRIVE_SECRET', 'test-secret')

# Remove leftovers from prior runs so each session starts clean.
_DB = os.path.join(os.path.dirname(__file__), '..', 'test_thrive.db')
if os.path.exists(_DB):
    os.remove(_DB)
