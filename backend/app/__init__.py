# backend app package

# Load a .env file at import time, BEFORE the submodules below read
# os.environ (api.py reads WHATSAPP_* at module level, db.py reads
# DATABASE_URL at module level). We try the repo root (README keeps .env
# there) and the backend/ dir, plus the current working directory.
# override=False means real process environment variables always win over
# the file, so CI and deploys that export the vars are unaffected.
try:
    import os
    from pathlib import Path

    from dotenv import load_dotenv

    _HERE = Path(__file__).resolve().parent            # .../backend/app
    if os.environ.get('THRIVE_SKIP_DOTENV') == '1':
        # Tests set this: the suite must not inherit a developer's real .env
        # (live WhatsApp credentials would make it exercise production paths).
        pass
    else:
        for _candidate in (_HERE / '../../.env', _HERE / '../.env',
                           Path('.env'), _HERE / '.env'):
            if _candidate.is_file():
                load_dotenv(_candidate, override=False)
                break
except ImportError:
    pass
