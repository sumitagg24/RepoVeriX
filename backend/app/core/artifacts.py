"""Artifact storage abstraction.

Repository archives, generated reports and verification bundles must not depend
on the API process's local disk in a multi-instance deployment. This module
defines a small storage seam with two adapters:

- :class:`LocalArtifactStorage` — development / single-instance default; keys
  are paths under a root directory.
- :class:`S3CompatibleArtifactStorage` — production; any S3-compatible object
  store (AWS S3, Cloudflare R2, MinIO) addressed with hand-rolled SigV4 so no
  heavyweight SDK is required for a five-operation surface.

The working tree for a scan still materialises on local disk (git and analysis
tooling need a filesystem); the seam covers *durable* artifacts that must
survive restarts and be reachable from any replica — uploaded archives are the
canonical case.

Selection is configuration-driven: ``artifact_storage = local | s3`` plus
``artifact_s3_*`` settings. The S3 adapter is fail-closed: a missing or partial
configuration raises at construction, never silently falls back to local disk.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol
from urllib.parse import quote, urlencode, urlparse
from urllib.request import Request, urlopen

from app.core.config import get_settings

logger = logging.getLogger("repoverix.storage")

_EMPTY_SHA = hashlib.sha256(b"").hexdigest()


class ArtifactStorageError(RuntimeError):
    """Raised when an artifact cannot be stored or retrieved."""


class ArtifactStorage(Protocol):
    """Storage seam: keys are opaque strings, values are bytes."""

    def put(self, key: str, payload: bytes) -> str:
        """Store ``payload`` under ``key``; returns the key."""
        ...

    def get(self, key: str) -> bytes:
        """Return the bytes stored under ``key``."""
        ...

    def delete(self, key: str) -> None:
        """Delete the artifact at ``key`` (no error when absent)."""
        ...

    def delete_prefix(self, prefix: str) -> int:
        """Delete every artifact whose key starts with ``prefix``; returns count."""
        ...

    def exists(self, key: str) -> bool: ...


class LocalArtifactStorage:
    """Filesystem-backed storage under ``settings.repository_storage_dir``."""

    def __init__(self, root: str | Path | None = None) -> None:
        self.root = Path(root or get_settings().repository_storage_dir)

    def _path(self, key: str) -> Path:
        candidate = (self.root / key).resolve()
        root = self.root.resolve()
        if not candidate.is_relative_to(root):
            raise ArtifactStorageError("artifact key escapes storage root")
        return candidate

    def put(self, key: str, payload: bytes) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
        return key

    def get(self, key: str) -> bytes:
        path = self._path(key)
        if not path.exists():
            raise ArtifactStorageError(f"artifact not found: {key}")
        return path.read_bytes()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
        elif path.exists():
            path.unlink(missing_ok=True)

    def delete_prefix(self, prefix: str) -> int:
        base = self._path(prefix)
        count = 0
        if base.is_dir():
            for child in base.rglob("*"):
                if child.is_file():
                    child.unlink(missing_ok=True)
                    count += 1
            shutil.rmtree(base, ignore_errors=True)
        elif base.exists():
            base.unlink(missing_ok=True)
            count = 1
        return count

    def exists(self, key: str) -> bool:
        return self._path(key).exists()


class S3CompatibleArtifactStorage:
    """SigV4-signed storage against any S3-compatible endpoint.

    Path-style addressing is used for explicit endpoints (Cloudflare R2, MinIO,
    self-hosted MinIO-style gateways); the AWS default is virtual-host style
    (``bucket.s3.region.amazonaws.com``). All objects are stored with a
    single-PUT (artifacts are bounded by the repository upload cap, well under
    the 5 GiB single-PUT limit).
    """

    SESSION_TOKEN_HEADER = "x-amz-security-token"

    def __init__(
        self,
        *,
        bucket: str,
        access_key: str,
        secret_key: str,
        region: str = "auto",
        endpoint_url: str | None = None,
        prefix: str = "",
        session_token: str | None = None,
    ) -> None:
        if not bucket or not access_key or not secret_key:
            raise ArtifactStorageError(
                "S3 artifact storage requires ARTIFACT_S3_BUCKET, ARTIFACT_S3_ACCESS_KEY "
                "and ARTIFACT_S3_SECRET_KEY"
            )
        self.bucket = bucket
        self.access_key = access_key
        self.secret_key = secret_key
        self.session_token = session_token
        self.region = region or "auto"
        self.prefix = prefix.strip("/")

        if endpoint_url:
            parsed = urlparse(endpoint_url)
            if parsed.scheme not in ("http", "https") or not parsed.netloc:
                raise ArtifactStorageError(f"invalid ARTIFACT_S3_ENDPOINT: {endpoint_url!r}")
            self.scheme = parsed.scheme
            # Path-style unless the bucket is already encoded in the host.
            if parsed.netloc.lower().startswith(f"{bucket.lower()}."):
                self.host = parsed.netloc
                self.path_prefix = ""
            else:
                self.host = parsed.netloc
                self.path_prefix = f"/{quote(bucket)}"
        else:
            self.scheme = "https"
            self.host = f"{bucket}.s3.{self.region}.amazonaws.com"
            self.path_prefix = ""

    # ---- URL / key handling ---------------------------------------------
    def _object_key(self, key: str) -> str:
        full = f"{self.prefix}/{key}".lstrip("/")
        return quote(full, safe="/")

    def _url(self, object_key: str, query: str = "") -> str:
        url = f"{self.scheme}://{self.host}{self.path_prefix}/{object_key}"
        return f"{url}?{query}" if query else url

    # ---- SigV4 -----------------------------------------------------------
    def _sign(
        self,
        method: str,
        object_key: str,
        payload_hash: str,
        query: str = "",
    ) -> dict[str, str]:
        now = datetime.now(UTC)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        datestamp = now.strftime("%Y%m%d")
        scope = f"{datestamp}/{self.region}/s3/aws4_request"
        signed_headers = "host;x-amz-content-sha256;x-amz-date"
        if self.session_token:
            signed_headers += ";" + self.SESSION_TOKEN_HEADER

        canonical_headers = "\n".join(
            [
                f"host:{self.host}",
                f"x-amz-content-sha256:{payload_hash}",
                f"x-amz-date:{amz_date}",
                *([f"{self.SESSION_TOKEN_HEADER}:{self.session_token}"] if self.session_token else []),
            ]
        )
        canonical_request = "\n".join(
            [
                method,
                f"{self.path_prefix}/{object_key}",
                query,
                canonical_headers + "\n",
                signed_headers,
                payload_hash,
            ]
        )
        string_to_sign = "\n".join(
            ["AWS4-HMAC-SHA256", amz_date, scope, hashlib.sha256(canonical_request.encode()).hexdigest()]
        )
        k_date = hmac.new(f"AWS4{self.secret_key}".encode(), datestamp.encode(), hashlib.sha256).digest()
        k_region = hmac.new(k_date, self.region.encode(), hashlib.sha256).digest()
        k_service = hmac.new(k_region, b"s3", hashlib.sha256).digest()
        k_signing = hmac.new(k_service, b"aws4_request", hashlib.sha256).digest()
        signature = hmac.new(k_signing, string_to_sign.encode(), hashlib.sha256).hexdigest()

        headers = {
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
            "Authorization": (
                f"AWS4-HMAC-SHA256 Credential={self.access_key}/{scope}, "
                f"SignedHeaders={signed_headers}, Signature={signature}"
            ),
        }
        if self.session_token:
            headers[self.SESSION_TOKEN_HEADER] = self.session_token
        return headers

    def _request(
        self, method: str, key: str, payload: bytes | None = None, query: str = ""
    ) -> tuple[int, bytes]:
        object_key = self._object_key(key)
        payload_hash = hashlib.sha256(payload or b"").hexdigest()
        headers = self._sign(method, object_key, payload_hash, query=query)
        request = Request(self._url(object_key, query), data=payload, headers=headers, method=method)
        try:
            with urlopen(request, timeout=60) as resp:
                return resp.status, resp.read()
        except Exception as exc:
            status = getattr(exc, "code", 0)
            raise ArtifactStorageError(f"S3 {method} failed (HTTP {status or 'network'}): {exc}") from exc

    # ---- ArtifactStorage -------------------------------------------------
    def put(self, key: str, payload: bytes) -> str:
        status, _ = self._request("PUT", key, payload=payload)
        if status not in (200, 201):
            raise ArtifactStorageError(f"S3 PUT failed with HTTP {status}")
        return key

    def get(self, key: str) -> bytes:
        status, body = self._request("GET", key)
        if status != 200:
            raise ArtifactStorageError(f"S3 GET failed with HTTP {status}")
        return body

    def delete(self, key: str) -> None:
        try:
            self._request("DELETE", key)
        except ArtifactStorageError:
            pass  # deleting an absent key must be idempotent

    def delete_prefix(self, prefix: str) -> int:
        """List keys under ``prefix`` (ListObjectsV2) and delete each."""
        list_prefix = quote(f"{self.prefix}/{prefix}".lstrip("/"), safe="/")
        list_query = urlencode({"list-type": "2", "prefix": list_prefix})
        object_key = ""  # bucket-level listing; prefix comes via query string
        payload_hash = _EMPTY_SHA
        headers = self._sign("GET", object_key, payload_hash, query=list_query)
        request = Request(self._url(object_key, list_query), headers=headers, method="GET")
        try:
            with urlopen(request, timeout=60) as resp:
                body = resp.read().decode("utf-8", "replace")
        except Exception as exc:
            raise ArtifactStorageError(f"S3 LIST failed: {exc}") from exc
        count = 0
        import re as _re

        for match in _re.finditer(r"<Key>([^<]+)</Key>", body):
            from urllib.parse import unquote

            listed = unquote(match.group(1))
            if self.prefix and listed.startswith(f"{self.prefix}/"):
                listed = listed[len(self.prefix) + 1 :]
            self.delete(listed)
            count += 1
        return count

    def exists(self, key: str) -> bool:
        object_key = self._object_key(key)
        headers = self._sign("HEAD", object_key, _EMPTY_SHA)
        request = Request(self._url(object_key), headers=headers, method="HEAD")
        try:
            with urlopen(request, timeout=30) as resp:
                return resp.status == 200
        except Exception:
            return False


_instance: ArtifactStorage | None = None


def reset_artifact_storage() -> None:
    """Drop the cached adapter (used by tests)."""
    global _instance
    _instance = None


def get_artifact_storage() -> ArtifactStorage:
    """Return the configured storage adapter (cached per process)."""
    global _instance
    if _instance is not None:
        return _instance
    settings = get_settings()
    backend = (settings.artifact_storage or "local").lower()
    if backend == "s3":
        _instance = S3CompatibleArtifactStorage(
            bucket=settings.artifact_s3_bucket,
            access_key=settings.artifact_s3_access_key or os.environ.get("AWS_ACCESS_KEY_ID", ""),
            secret_key=settings.artifact_s3_secret_key or os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
            region=settings.artifact_s3_region,
            endpoint_url=settings.artifact_s3_endpoint or None,
            prefix=settings.artifact_s3_prefix,
        )
    elif backend == "local":
        _instance = LocalArtifactStorage()
    else:
        raise ArtifactStorageError(f"unknown artifact_storage backend: {backend!r}")
    logger.info("artifact storage initialised backend=%s", backend)
    return _instance
