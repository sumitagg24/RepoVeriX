# Demo Shop (INTENTIONALLY VULNERABLE)

**WARNING: This repository is deliberately seeded with security and logic
defects for RepoVeriX demonstrations, tests and benchmarks. Do not deploy,
and do not treat any credential here as real.**

All credentials are fake demo placeholders (e.g. `sk-demo-...`).

Seeded defects:
- SQL injection in `search_users` (route handler in `app.py`)
- Hardcoded fake API key (`DEMO_API_KEY`)
- Command injection via `subprocess` with `shell=True`
- Unsafe `eval` of dynamic input
- Weak `md5` hashing
- Silently swallowed exception (`except: pass`)
- Incorrect comparison boundary in `apply_discount` (logic)
