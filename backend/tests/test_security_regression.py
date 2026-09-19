"""Comprehensive security regression test suite for RepoVeriX.

Covers:
- SSRF prevention (private CIDRs, IPv4-mapped IPv6, metadata, dangerous schemes)
- Centralized credential and URL userinfo redaction
- OAuth PKCE, state token handling, and open redirect defenses
- Dynamic tenant domain security (Auth0 and Oracle SSRF gates)
- Archive extraction path containment (Zip Slip)
- Multi-tenant IDOR / BOLA authorization boundaries
"""

from __future__ import annotations

import io
import uuid
import zipfile
from pathlib import Path

import pytest

from app.analysis.ingest import extract_archive, store_archive
from app.analysis.models import AnalysisError
from app.api.routes.oauth import _sanitize_next_path
from app.core.config import Settings
from app.core.redact import redact_string, redact_url
from app.core.ssrf import SSRFBlocked, assert_safe_url, validate_url
from app.db.models import Repository, User
from app.services import access
from app.services import oauth as oauth_service


# --------------------------------------------------------------------------- SSRF Tests
def test_ssrf_blocks_private_and_metadata_ips():
    """All RFC 1918, loopback, link-local, and cloud metadata targets must be blocked."""
    blocked_targets = [
        "http://127.0.0.1/admin",
        "http://127.0.0.2:8080/metrics",
        "http://localhost/status",
        "http://10.0.0.1/internal",
        "http://172.16.0.1/secrets",
        "http://172.31.255.255/secrets",
        "http://192.168.1.1/router",
        "http://169.254.169.254/latest/meta-data/",
        "http://[::1]/status",
        "http://[fe80::1]/link-local",
        "http://[fc00::1]/unique-local",
        "http://[::ffff:127.0.0.1]/status",
        "http://[::ffff:169.254.169.254]/latest/meta-data/",
        "http://[::ffff:10.0.0.1]/internal",
        "http://192.0.2.1/documentation-net",
        "http://224.0.0.1/multicast",
    ]
    for target in blocked_targets:
        decision = validate_url(target)
        assert decision.allowed is False, f"Expected {target} to be blocked by SSRF guard"
        with pytest.raises(SSRFBlocked):
            assert_safe_url(target)


def test_ssrf_rejects_dangerous_non_http_schemes():
    """Dangerous URL schemes must be rejected outright by the SSRF validator."""
    dangerous_targets = [
        "file:///etc/passwd",
        "file:///C:/Windows/System32/drivers/etc/hosts",
        "gopher://127.0.0.1:6379/_INFO",
        "dict://127.0.0.1:11211/stat",
        "ftp://example.com/repo.zip",
        "data:text/plain;base64,SGVsbG8=",
        "javascript:alert(1)",
    ]
    for target in dangerous_targets:
        decision = validate_url(target)
        assert decision.allowed is False, f"Expected non-http scheme {target} to be rejected"


def test_ssrf_permits_public_fqdns():
    """Public internet targets with legitimate addresses must be permitted."""

    def fake_public_dns(host: str):
        import ipaddress

        return [ipaddress.ip_address("93.184.216.34")]  # example.com

    decision = validate_url("https://github.com/octocat/Hello-World", resolver=fake_public_dns)
    assert decision.allowed is True


# --------------------------------------------------------------------------- Credential Redaction
def test_redact_url_userinfo_and_tokens():
    """Passwords, access tokens, and sensitive query params must be redacted from URLs."""
    # Basic user:pass
    assert (
        redact_url("https://deployer:supersecretpassword@github.com/org/repo.git")
        == "https://deployer:[REDACTED]@github.com/org/repo.git"
    )
    # GitHub personal access token in userinfo
    assert (
        redact_url("https://x-access-token:ghp_123456789012345678901234567890@github.com/repo.git")
        == "https://x-access-token:[REDACTED]@github.com/repo.git"
    )
    # Token-only userinfo
    assert (
        redact_url("https://glpat-abcdef1234567890@gitlab.com/group/project.git")
        == "https://[REDACTED]@gitlab.com/group/project.git"
    )
    # Sensitive query parameters
    assert (
        redact_url("https://api.example.com/v1/resource?token=secret123&public=ok")
        == "https://api.example.com/v1/resource?token=%5BREDACTED%5D&public=ok"
    )


def test_redact_string_in_command_output():
    """Tokens embedded inside unstructured log strings or exception text must be redacted."""
    raw_error = (
        "git clone failed: fatal: could not read Password for "
        "'https://user:mypassword@github.com': No such device"
    )
    redacted = redact_string(raw_error)
    assert "mypassword" not in redacted
    assert "[REDACTED]" in redacted

    raw_token_log = "Using token ghp_111122223333444455556666777788889999 for API request"
    assert "ghp_111122223333444455556666777788889999" not in redact_string(raw_token_log)


# --------------------------------------------------------------------------- OAuth PKCE & Open Redirects
def test_pkce_generation_and_challenge():
    """PKCE code_verifier and S256 code_challenge must match RFC 7636."""
    verifier = oauth_service.new_pkce_verifier()
    assert len(verifier) >= 43
    challenge = oauth_service.pkce_challenge(verifier)
    assert len(challenge) >= 43
    assert "=" not in challenge  # URL-safe base64 unpadded


def test_sanitize_next_path_prevents_open_redirects():
    """Open redirect vectors must be neutralized to /dashboard."""
    malicious_paths = [
        "//attacker.com",
        "//attacker.com/steal",
        "/\\attacker.com",
        "\\attacker.com",
        "https://attacker.com",
        "http://attacker.com",
        "javascript:alert(1)",
        "/dashboard\r\nSet-Cookie: evil=1",
        "",
        None,
    ]
    for path in malicious_paths:
        sanitized = _sanitize_next_path(path)
        assert sanitized == "/dashboard", f"Expected {path!r} to be sanitized to /dashboard"

    # Legitimate same-origin relative paths are preserved
    assert _sanitize_next_path("/repositories/new") == "/repositories/new"
    assert _sanitize_next_path("/settings/integrations") == "/settings/integrations"


def test_dynamic_tenant_ssrf_guards():
    """Configuring an internal IP as Auth0 domain or Oracle IDCS URL must be blocked."""
    evil_settings = Settings(
        auth0_domain="169.254.169.254",
        auth0_oauth_client_id="id",
        auth0_oauth_client_secret="secret",
    )
    with pytest.raises(SSRFBlocked):
        oauth_service.get_provider_spec("auth0", evil_settings)

    evil_oracle = Settings(
        oracle_idcs_url="http://127.0.0.1:8000",
        oracle_oauth_client_id="id",
        oracle_oauth_client_secret="secret",
    )
    with pytest.raises(SSRFBlocked):
        oauth_service.get_provider_spec("oracle", evil_oracle)


# --------------------------------------------------------------------------- Archive Extraction Security
def test_extract_archive_blocks_zip_slip(tmp_path: Path):
    """Zip Slip directory traversal in archive members must be rejected."""
    repo_id = str(uuid.uuid4())
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../etc/cron.d/malicious", b"* * * * * root reboot\n")
    store_archive(repo_id, buf.getvalue(), storage_root=tmp_path)

    with pytest.raises(AnalysisError) as exc_info:
        extract_archive(repo_id, storage_root=tmp_path)
    assert exc_info.value.code == "unsafe_archive"


# --------------------------------------------------------------------------- Multi-Tenant Boundaries
@pytest.mark.asyncio
async def test_user_cannot_access_other_user_repository(db_session, test_user):
    """User B cannot load or inspect User A's private repository."""
    other_user = User(
        email="user_b@example.com",
        hashed_password="fakehash",
        full_name="User B",
        is_active=True,
    )
    db_session.add(other_user)
    await db_session.flush()

    repo = Repository(
        name="user_a_secret_repo",
        source_type="git",
        source_url="https://github.com/user_a/secret.git",
        owner_id=test_user.id,
    )
    db_session.add(repo)
    await db_session.commit()

    # User A has access
    loaded_a = await access.load_repository(db_session, repo.id, test_user.id)
    assert loaded_a.id == repo.id

    # User B is denied access (raises AccessDenied -> mapped to 404 in routes)
    with pytest.raises(access.AccessDenied):
        await access.load_repository(db_session, repo.id, other_user.id)


# --------------------------------------------------------------------------- Patch Application Containment
def test_apply_patch_to_directory_blocks_path_traversal(tmp_path: Path):
    """Patch targets with directory traversal escaping the working copy must be rejected."""
    from app.analysis.patchops import PatchError, apply_patch_to_directory

    victim_file = tmp_path.parent / "escape_target.txt"
    victim_file.write_text("original content\n", encoding="utf-8")

    workspace = tmp_path / "workspace"
    workspace.mkdir()

    escaping_patch = """--- a/../escape_target.txt
+++ b/../escape_target.txt
@@ -1,1 +1,1 @@
-original content
+overwritten content
"""
    with pytest.raises(PatchError) as exc_info:
        apply_patch_to_directory(workspace, escaping_patch)

    assert exc_info.value.code == "patch_escape"
    assert victim_file.read_text(encoding="utf-8") == "original content\n"


# --------------------------------------------------------------------------- Production Config Fail-Closed
def test_production_safety_enforces_strong_secrets():
    """Production mode must reject default or short jwt_secret, invalid fernet keys, and console email."""
    from app.core.config import ensure_production_safety

    # Default jwt_secret in production must fail
    prod_with_default_secret = Settings(
        environment="production",
        jwt_secret="change-me-in-production",
        email_backend="smtp",
    )
    with pytest.raises(RuntimeError, match="REPOVERIX_JWT_SECRET"):
        ensure_production_safety(prod_with_default_secret)

    # Weak/short jwt_secret in production must fail
    prod_with_weak_secret = Settings(
        environment="production",
        jwt_secret="short",
        email_backend="smtp",
    )
    with pytest.raises(RuntimeError, match="REPOVERIX_JWT_SECRET"):
        ensure_production_safety(prod_with_weak_secret)

    # Invalid fernet token_encryption_key must fail
    prod_with_invalid_fernet = Settings(
        environment="production",
        jwt_secret="super-long-secure-random-secret-key-32-chars-minimum",
        token_encryption_key="not-a-valid-fernet-key",
        email_backend="smtp",
    )
    with pytest.raises(RuntimeError, match="REPOVERIX_TOKEN_ENCRYPTION_KEY"):
        ensure_production_safety(prod_with_invalid_fernet)

    # Console email backend in explicit production must fail
    prod_with_console_email = Settings(
        environment="production",
        jwt_secret="super-long-secure-random-secret-key-32-chars-minimum",
        email_backend="console",
    )
    with pytest.raises(RuntimeError, match="REPOVERIX_EMAIL_BACKEND"):
        ensure_production_safety(prod_with_console_email)

    # Valid production settings pass
    from cryptography.fernet import Fernet

    valid_fernet = Fernet.generate_key().decode()
    valid_prod = Settings(
        environment="production",
        jwt_secret="super-long-secure-random-secret-key-32-chars-minimum",
        token_encryption_key=valid_fernet,
        email_backend="smtp",
    )
    # Should not raise
    ensure_production_safety(valid_prod)
