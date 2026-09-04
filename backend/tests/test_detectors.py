"""Unit tests for the built-in deterministic detectors."""

from app.analysis.detectors import detect_all
from app.analysis.parsing import parse_source
from app.db.models import EvidenceKind, Severity


def _findings(source: str, language: str, path: str):
    pf = parse_source(source, language, path)
    return detect_all(pf), pf


VULNERABLE_PY = """\
DEMO_API_KEY = "sk-demo-4f2b9c1e7d6a8f3b2c5d9e1a7f4b8c2d6e0a3f1b"

def route(path):
    def wrap(fn):
        return fn
    return wrap

@route("/search")
def search_users(name):
    conn, cursor = get_db()
    query = f"SELECT * FROM users WHERE name = '{name}'"
    cursor.execute(query)
    return cursor.fetchall()

def ping(hostname):
    import subprocess
    subprocess.call(f"ping -c 1 {hostname}", shell=True)
    return "ok"

def compute(expr):
    return eval(expr)

def fingerprint(token):
    import hashlib
    return hashlib.md5(token.encode()).hexdigest()

def fragile():
    try:
        risky()
    except Exception:
        pass
"""


def test_python_detectors_find_seeded_issues():
    findings, pf = _findings(VULNERABLE_PY, "python", "app.py")
    rules = {f.rule for f in findings}
    assert "RVX-SQLI-001" in rules
    assert "RVX-SECRET-001" in rules
    assert "RVX-CMDI-001" in rules
    assert "RVX-EVAL-001" in rules
    assert "RVX-CRYPTO-001" in rules
    assert "RVX-EXCEPT-001" in rules

    sqli = next(f for f in findings if f.rule == "RVX-SQLI-001")
    assert sqli.severity == Severity.critical  # route handler with parameter taint
    kinds = {e.kind for e in sqli.evidence}
    assert EvidenceKind.sink in kinds
    assert EvidenceKind.source_input in kinds
    assert EvidenceKind.transformation in kinds

    secret = next(f for f in findings if f.rule == "RVX-SECRET-001")
    assert secret.file_path == "app.py"
    assert secret.confidence >= 0.8


SAFE_PY = """\
import sqlite3

def search_users(name):
    conn = sqlite3.connect("db.sqlite")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE name = ?", (name,))
    return cursor.fetchall()

def constant_query():
    cursor = sqlite3.connect("db.sqlite").cursor()
    query = "SELECT 1"
    cursor.execute(query)
"""


def test_parameterized_and_constant_queries_not_flagged():
    findings, _pf = _findings(SAFE_PY, "python", "safe.py")
    assert all(f.rule != "RVX-SQLI-001" for f in findings)


SECRET_PLACEHOLDER_PY = 'PASSWORD = "changeme-please-1234567890"\n'


def test_placeholder_secret_not_flagged():
    findings, _pf = _findings(SECRET_PLACEHOLDER_PY, "python", "config.py")
    assert all("SECRET" not in f.rule for f in findings)


VULNERABLE_JS = """\
const express = require("express");
const { Client } = require("pg");
const { exec } = require("child_process");

const STRIPE_SECRET = "sk-demo-7f3a9c2e4b8d1f6a5c3e9b7d2f4a8c6e0b1d3f5a";

app.get("/search", async (req, res) => {
  const name = req.query.name;
  const query = `SELECT * FROM users WHERE name = '${name}'`;
  const result = await client.query(query);
  res.json(result.rows);
});

app.get("/ping", (req, res) => {
  const host = req.query.host;
  exec(`ping -c 1 ${host}`, (err, stdout) => res.send(stdout));
});

app.get("/eval", (req, res) => {
  res.json({ result: eval(req.query.expr) });
});
"""


def test_javascript_detectors_find_seeded_issues():
    findings, _pf = _findings(VULNERABLE_JS, "javascript", "server.js")
    rules = {f.rule for f in findings}
    assert "RVX-SQLI-JS-001" in rules
    assert "RVX-SECRET-JS-001" in rules
    assert "RVX-CMDI-JS-001" in rules
    assert "RVX-EVAL-JS-001" in rules

    sqli = next(f for f in findings if f.rule == "RVX-SQLI-JS-001")
    kinds = {e.kind for e in sqli.evidence}
    assert EvidenceKind.sink in kinds
    assert EvidenceKind.transformation in kinds
