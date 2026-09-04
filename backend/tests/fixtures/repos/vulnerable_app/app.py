"""Demo Shop application — INTENTIONALLY VULNERABLE.

This file is a deliberately seeded repository used by RepoVeriX tests,
demonstrations and benchmarks. Every credential is fake. Do not deploy.
"""

import hashlib
import os
import sqlite3
import subprocess


DEMO_API_KEY = "sk-demo-4f2b9c1e7d6a8f3b2c5d9e1a7f4b8c2d6e0a3f1b"

# A minimal stand-in for a web framework so the demo runs without dependencies.
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


def connect_user(conn, cursor, username):
    """Connect a user session (helper used by other routes)."""
    cursor.execute("SELECT * FROM users WHERE name = ?", (username,))
    return cursor.fetchone()


def build_query(name):
    """Construct a search query string from user input (helper)."""
    return f"SELECT * FROM users WHERE name = '{name}'"


@router.route("/search")
def search_users(name):
    """Search users by name. The name is interpolated straight into SQL."""
    conn, cursor = get_db()
    query = f"SELECT * FROM users WHERE name = '{name}'"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return rows


@router.route("/users")
def list_users_using_helper(name):
    conn, cursor = get_db()
    cursor.execute(build_query(name))
    rows = cursor.fetchall()
    conn.close()
    return rows


@router.route("/admin")
def run_report(hostname):
    """Ping a host supplied by the caller (command injection demo)."""
    command = f"ping -c 1 {hostname}"
    subprocess.call(command, shell=True)
    return "ok"


@router.route("/score")
def score(expression):
    """Evaluate a caller-supplied expression (unsafe eval demo)."""
    return eval(expression)


def fingerprint(token):
    """Create a fingerprint for a token (weak hash demo)."""
    return hashlib.md5(token.encode("utf-8")).hexdigest()


def apply_discount(price, discount_code):
    """Apply a discount when the code is valid (logic bug demo)."""
    valid_codes = {"SAVE10": 0.10, "SAVE20": 0.20}
    if discount_code not in valid_codes:
        return price
    try:
        return price * (1 - valid_codes[discount_code])
    except Exception:
        pass
    return price
