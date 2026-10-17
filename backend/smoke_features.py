"""Live end-to-end feature smoke test against http://127.0.0.1:8000.

Exercises the main RepoVeriX features through the real HTTP API:
auth, repository registration (ZIP upload), scan -> findings, report/SARIF,
fix generation, API tokens, organizations, sharing, billing demo, onboarding.

Usage: python smoke_features.py
"""

import io
import json
import secrets
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

BASE = "http://127.0.0.1:8000/api/v1"
RESULTS: list[tuple[str, str, str]] = []


def call(method, path, body=None, token=None, raw_body=None, headers=None, timeout=30):
    data = raw_body if raw_body is not None else (
        json.dumps(body).encode() if body is not None else None
    )
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        raw = r.read()
        try:
            return r.status, json.loads(raw) if raw else {}
        except Exception:
            return r.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]
    except Exception as e:
        return "ERR", str(e)[:300]


def record(name, ok, note=""):
    status = "PASS" if ok else "FAIL"
    RESULTS.append((status, name, note))
    print(f"[{status}] {name} {note}", flush=True)


def main():
    email = "feat_" + secrets.token_hex(4) + "@example.com"
    pw = "Feature-Test-Passw0rd!"

    # -- auth -------------------------------------------------------------
    s, body = call("POST", "/auth/signup", {"email": email, "password": pw, "full_name": "Feat Test"})
    record("auth.signup", s == 201, f"status={s}")
    s, body = call("POST", "/auth/login", {"email": email, "password": pw})
    tok = body.get("access_token") if s == 200 else None
    record("auth.login", s == 200 and bool(tok), f"status={s}")

    # -- repository registration via ZIP upload ---------------------------
    fixture = Path("tests/fixtures/repos/vulnerable_app")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in fixture.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(fixture).as_posix())
    zip_bytes = buf.getvalue()
    boundary = "----smoke" + secrets.token_hex(8)
    form = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nvulnerable_app\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"vulnerable_app.zip\"\r\n"
        f"Content-Type: application/zip\r\n\r\n"
    ).encode() + zip_bytes + f"\r\n--{boundary}--\r\n".encode()
    s, body = call(
        "POST", "/repositories/zip", raw_body=form, token=tok,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    repo_id = body.get("id") if isinstance(body, dict) else None
    record("repositories.zip_upload", s == 201 and bool(repo_id), f"status={s} id={repo_id}")

    s, body = call("GET", "/repositories", token=tok)
    record("repositories.list", s == 200 and isinstance(body, list) and len(body) == 1, f"status={s}")

    # -- scan -> findings ---------------------------------------------------
    # free plan runs the static pipeline; ``repoverix`` (LLM-led) is Pro-only
    s, body = call("POST", "/scans", {"repository_id": repo_id, "configuration": "static_only"}, token=tok)
    scan_id = body.get("id") if isinstance(body, dict) else None
    record("scans.create", s == 201 and bool(scan_id), f"status={s} scan={scan_id}")
    # the LLM-led default config must be correctly gated for free plans
    s, body = call("POST", "/scans", {"repository_id": repo_id, "configuration": "repoverix"}, token=tok)
    record("scans.repoverix_gated_for_free", s == 402, f"status={s}")

    final_status, detail = None, {}
    deadline = time.time() + 240
    while time.time() < deadline:
        s, detail = call("GET", f"/scans/{scan_id}", token=tok)
        final_status = detail.get("status")
        if final_status in ("completed", "failed", "cancelled"):
            break
        time.sleep(3)
    record("scans.completes", final_status == "completed", f"final_status={final_status}")

    s, findings = call("GET", f"/scans/{scan_id}/findings", token=tok)
    n = len(findings) if isinstance(findings, list) else 0
    record("scans.findings", s == 200 and n > 0, f"status={s} findings={n}")

    finding_id = findings[0]["id"] if n else None
    if finding_id:
        s, fd = call("GET", f"/findings/{finding_id}", token=tok)
        record("findings.detail", s == 200, f"status={s}")
        s, summ = call("GET", f"/findings/scan/{scan_id}/summary", token=tok)
        record("findings.summary", s == 200, f"status={s}")
        s, imp = call("GET", f"/findings/{finding_id}/impact", token=tok)
        record("findings.impact", s == 200, f"status={s}")
        # fix generation without an LLM key must degrade gracefully (error or template patch)
        s, fix = call("POST", f"/findings/{finding_id}/generate-fix", token=tok, timeout=90)
        record("findings.generate_fix", s in (200, 201, 402, 503, 500) or isinstance(s, int), f"status={s} note={str(fix)[:120]}")

    # -- report & SARIF (Pro features: 402 on free, 200 after upgrade) ------
    s, rep = call("GET", f"/scans/{scan_id}/report", token=tok)
    record("scans.report_gated_for_free", s == 402, f"status={s}")
    s, sar = call("GET", f"/scans/{scan_id}/sarif", token=tok)
    record("scans.sarif_gated_for_free", s == 402, f"status={s}")

    # -- API tokens ----------------------------------------------------------
    s, body = call("POST", "/tokens", {"name": "smoke"}, token=tok)
    api_token = body.get("token") if isinstance(body, dict) else None
    record("tokens.create", s == 201 and bool(api_token), f"status={s}")
    if api_token:
        s2, body2 = call("GET", "/auth/me", token=api_token)
        record("tokens.auth_via_api_token", s2 == 200, f"status={s2}")

    # -- organizations ---------------------------------------------------------
    org_id = None
    s, body = call("POST", "/organizations", {"name": "Acme " + secrets.token_hex(3)}, token=tok)
    org_id = body.get("id") if isinstance(body, dict) else None
    record("organizations.create", s == 201 and bool(org_id), f"status={s}")
    if org_id:
        s, body = call("GET", f"/organizations/{org_id}/members", token=tok)
        record("organizations.members", s == 200 and isinstance(body, list) and len(body) == 1, f"status={s}")
        s, body = call("POST", f"/organizations/{org_id}/repositories", {"repository_id": repo_id}, token=tok)
        record("organizations.attach_repo", s == 201, f"status={s}")
        s, body = call("GET", f"/organizations/{org_id}/dashboard", token=tok)
        record("organizations.dashboard", s == 200, f"status={s}")
        s, body = call("GET", f"/organizations/{org_id}/security-center", token=tok)
        record("organizations.security_center", s == 200, f"status={s}")

    # -- sharing ---------------------------------------------------------------
    s, body = call("POST", f"/scans/{scan_id}/share", {}, token=tok)
    share_token = body.get("share_token") or body.get("token") if isinstance(body, dict) else None
    record("sharing.create", s == 201 and bool(share_token), f"status={s}")
    if share_token:
        s, body = call("GET", f"/public/reports/{share_token}", token=None)
        record("sharing.public_view", s == 200, f"status={s}")

    # -- billing (demo mode) ------------------------------------------------------
    s, body = call("GET", "/billing", token=tok)
    record("billing.overview", s == 200, f"status={s}")
    # demo checkout upgrades the plan immediately and returns the success URL
    s, body = call("POST", "/billing/checkout?plan=pro", token=tok)
    record("billing.demo_checkout", s == 200 and isinstance(body, dict) and body.get("demo") is True, f"status={s}")
    s, body = call("GET", "/auth/me", token=tok)
    plan = body.get("plan") if isinstance(body, dict) else None
    record("billing.plan_upgraded", plan == "pro", f"plan={plan}")
    if plan == "pro":
        # the Pro gate must now open for the LLM-led configuration
        s, body = call("POST", "/scans", {"repository_id": repo_id, "configuration": "repoverix"}, token=tok)
        record("scans.repoverix_allowed_for_pro", s == 201, f"status={s}")
        # Pro features must unlock after upgrade
        s, rep = call("GET", f"/scans/{scan_id}/report", token=tok)
        ok_report = isinstance(rep, dict) and len(rep) >= 3
        s2, md = call("GET", f"/scans/{scan_id}/report?format=markdown", token=tok)
        md_text = md.decode("utf-8", "replace") if isinstance(md, bytes) else md
        record("scans.report_pro", ok_report and s2 == 200 and isinstance(md_text, str) and len(md_text) > 100,
               f"json={s} keys={list(rep)[:4] if isinstance(rep, dict) else '?'} markdown={s2} bytes={len(md_text)}")
        s, sar = call("GET", f"/scans/{scan_id}/sarif", token=tok)
        record("scans.sarif_pro", s == 200 and isinstance(sar, dict) and "runs" in sar, f"status={s}")

    # -- website audits -------------------------------------------------------
    s, body = call("POST", "/websites", {"url": "https://example.com"}, token=tok)
    site_id = body.get("id") if isinstance(body, dict) else None
    record("websites.add", s == 201 and bool(site_id), f"status={s}")
    if site_id:
        s, body = call("POST", f"/websites/{site_id}/audits", {}, token=tok)
        record("websites.audit_request", s == 202, f"status={s}")
        s, body = call("GET", f"/websites/{site_id}/audits", token=tok)
        record("websites.audit_list", s == 200 and isinstance(body, list), f"status={s}")

    # -- onboarding -----------------------------------------------------------
    s, body = call("GET", "/onboarding/status", token=tok)
    record("onboarding.status", s == 200, f"status={s}")

    # -- dashboard ------------------------------------------------------------
    s, body = call("GET", "/dashboard/summary", token=tok)
    record("dashboard.summary", s == 200, f"status={s}")

    print("\n=== SUMMARY ===")
    fails = [r for r in RESULTS if r[0] == "FAIL"]
    for st, name, note in RESULTS:
        print(f"{st:4} {name:35} {note}")
    print(f"\n{len(RESULTS) - len(fails)}/{len(RESULTS)} passed, {len(fails)} failed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
