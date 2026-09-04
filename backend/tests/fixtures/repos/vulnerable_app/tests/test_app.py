"""Tests for the demo app.

These run inside the verification sandbox to prove a repair keeps behaviour.
The SQL injection test is written so the *vulnerable* implementation fails it
(asserting parameterized access), which is what makes verification meaningful.
"""

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as demo  # noqa: E402


def _seed_db():
    conn = sqlite3.connect(demo.DB_PATH)
    conn.execute("DROP TABLE IF EXISTS users")
    conn.execute("CREATE TABLE users (name TEXT PRIMARY KEY, email TEXT)")
    conn.execute("INSERT INTO users VALUES ('alice', 'alice@example.com')")
    conn.execute("INSERT INTO users VALUES ('bob', 'bob@example.com')")
    conn.commit()
    conn.close()


def test_search_returns_matching_rows():
    _seed_db()
    rows = demo.search_users("alice")
    assert len(rows) == 1
    assert rows[0][0] == "alice"


def test_search_does_not_allow_injection():
    """A correct implementation must not return all rows for a crafted input."""
    _seed_db()
    rows = demo.search_users("' OR '1'='1")
    assert len(rows) == 0, "SQL injection succeeded: query returned rows"


def test_apply_discount_applies_valid_code():
    assert demo.apply_discount(100.0, "SAVE10") == 90.0


def test_apply_discount_rejects_unknown_code():
    assert demo.apply_discount(100.0, "NOPE") == 100.0
