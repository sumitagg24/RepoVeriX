"""Demo Shop application — FIXED REFERENCE VERSION.

Equivalent to app.py with the seeded defects repaired. Used by verification
tests as the "ground truth" of a successful repair. Do not deploy.
"""

import hashlib
import os
import secrets
import sqlite3
import subprocess

# Secret moved to environment (fake fallback only)
DEMO_API_KEY = os.environ.get("DEMO_API_KEY", "")


class Router:
    def __init__(self):
        self._routes = {}

    def route(self, path):
        def wrap(func):
            self._routes[path] = func
            return func

        return wrap


router = Router()
DB_PATH = os.path.join(os.path.dirname(__file__), "demo.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    return conn, conn.cursor()


@router.route("/search")
def search_users(name):
    """Search users by name using a parameterized query."""
    conn, cursor = get_db()
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
    rows = cursor.fetchall()
    conn.close()
    return rows


@router.route("/admin")
def run_report(hostname):
    """Ping a host using an argument list — no shell interpolation."""
    subprocess.run(["ping", "-c", "1", hostname], shell=False, timeout=10)
    return "ok"


@router.route("/score")
def score(expression):
    """Refuse to evaluate arbitrary expressions."""
    raise ValueError("expression evaluation is disabled")


def fingerprint(token):
    """Create a fingerprint using a keyed, collision-resistant HMAC."""
    digest = hashlib.sha256(secrets.token_bytes(16) + token.encode("utf-8")).hexdigest()
    return digest


def apply_discount(price, discount_code):
    """Apply a discount when the code is valid."""
    valid_codes = {"SAVE10": 0.10, "SAVE20": 0.20}
    if discount_code not in valid_codes:
        return price
    return price * (1 - valid_codes[discount_code])
