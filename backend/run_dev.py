"""Local development launcher.

Sets the SQLite development database URL (the config default targets
PostgreSQL, which is not what a quick local run wants) and starts uvicorn.

    python run_dev.py

or, on Windows behind PowerShell (bash eats ``$env:``):

    powershell -NoProfile -Command
    "Start-Process -FilePath '.venv\\Scripts\\python.exe' -ArgumentList 'run_dev.py' ..."
"""

import os

os.environ.setdefault("REPOVERIX_DATABASE_URL", "sqlite+aiosqlite:///./data/dev.db")
os.environ.setdefault("REPOVERIX_ALLOWED_HOSTS", '["localhost", "127.0.0.1", "test"]')
os.environ.setdefault("REPOVERIX_EXPOSE_API_DOCS", "false")
# Dev servers commonly drift to :3001 (port 3000 is a shared default), so the
# CORS allowlist must cover it or every browser request dies pre-flight and
# the UI fails silently (curl-only testing never notices).
os.environ.setdefault(
    "REPOVERIX_CORS_ORIGINS",
    '["http://localhost:3000", "http://127.0.0.1:3000", '
    '"http://localhost:3001", "http://127.0.0.1:3001"]',
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
