"""Artifact-storage seam tests.

The local adapter is exercised fully. The S3 adapter is checked structurally
(fail-closed config, endpoint handling, canonical-request determinism); its
real HTTP semantics run against a throwaway MinIO container only when a Docker
daemon is available, and skip otherwise.
"""

from __future__ import annotations

import socket
import subprocess
import time
from pathlib import Path

import pytest
from pytest import MonkeyPatch

from app.core.artifacts import (
    ArtifactStorageError,
    LocalArtifactStorage,
    S3CompatibleArtifactStorage,
    get_artifact_storage,
    reset_artifact_storage,
)


@pytest.fixture()
def local_root(tmp_path: Path) -> Path:
    return tmp_path / "artifacts"


class TestLocalAdapter:
    def test_round_trip(self, local_root: Path) -> None:
        store = LocalArtifactStorage(root=local_root)
        assert store.put("archives/r1/archive.zip", b"payload") == "archives/r1/archive.zip"
        assert store.get("archives/r1/archive.zip") == b"payload"
        assert store.exists("archives/r1/archive.zip") is True

    def test_missing_key_raises(self, local_root: Path) -> None:
        store = LocalArtifactStorage(root=local_root)
        with pytest.raises(ArtifactStorageError):
            store.get("no/such/key")

    def test_delete_is_idempotent(self, local_root: Path) -> None:
        store = LocalArtifactStorage(root=local_root)
        store.put("k", b"v")
        store.delete("k")
        store.delete("k")  # no error
        assert store.exists("k") is False

    def test_delete_prefix_removes_subtree(self, local_root: Path) -> None:
        store = LocalArtifactStorage(root=local_root)
        store.put("archives/a/one", b"1")
        store.put("archives/a/two", b"2")
        store.put("archives/b/three", b"3")
        assert store.delete_prefix("archives/a") == 2
        assert store.exists("archives/a/one") is False
        assert store.exists("archives/b/three") is True

    def test_key_traversal_rejected(self, local_root: Path) -> None:
        store = LocalArtifactStorage(root=local_root)
        with pytest.raises(ArtifactStorageError):
            store.put("../escape", b"x")


class TestS3Configuration:
    def test_missing_credentials_fail_closed(self) -> None:
        with pytest.raises(ArtifactStorageError):
            S3CompatibleArtifactStorage(bucket="b", access_key="", secret_key="s")

    def test_invalid_endpoint_rejected(self) -> None:
        with pytest.raises(ArtifactStorageError):
            S3CompatibleArtifactStorage(bucket="b", access_key="a", secret_key="s", endpoint_url="not-a-url")

    def test_r2_path_style_endpoint(self) -> None:
        store = S3CompatibleArtifactStorage(
            bucket="repoverix",
            access_key="a",
            secret_key="s",
            endpoint_url="https://accountid.r2.cloudflarestorage.com",
        )
        assert store.host == "accountid.r2.cloudflarestorage.com"
        assert store.path_prefix == "/repoverix"
        assert (
            store._url(store._object_key("x/y.zip"))
            == "https://accountid.r2.cloudflarestorage.com/repoverix/x/y.zip"
        )

    def test_bucket_in_host_is_virtual_style(self) -> None:
        store = S3CompatibleArtifactStorage(
            bucket="b", access_key="a", secret_key="s", endpoint_url="https://b.s3.us-east-1.amazonaws.com"
        )
        assert store.path_prefix == ""

    def test_prefix_applied(self) -> None:
        store = S3CompatibleArtifactStorage(bucket="b", access_key="a", secret_key="s", prefix="tenant/x")
        assert store._object_key("archives/1.zip") == "tenant/x/archives/1.zip"

    def test_signature_headers_deterministic_shape(self) -> None:
        store = S3CompatibleArtifactStorage(bucket="b", access_key="a", secret_key="s", region="us-east-1")
        headers = store._sign("PUT", "k", hashlib_payload := "abc123")
        assert headers["x-amz-content-sha256"] == "abc123"
        assert "AWS4-HMAC-SHA256 Credential=a/" in headers["Authorization"]
        assert "us-east-1/s3/aws4_request" in headers["Authorization"]
        assert headers["x-amz-date"].endswith("Z")
        del hashlib_payload


def _docker_available() -> bool:
    try:
        result = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"], capture_output=True, timeout=10
        )
        return result.returncode == 0
    except Exception:
        return False


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.mark.skipif(not _docker_available(), reason="Docker daemon not available")
class TestLiveMinIO:
    """Real SigV4 semantics against a throwaway MinIO — the integration proof."""

    @pytest.fixture(scope="class")
    def minio(self, request: pytest.FixtureRequest):
        port = _free_port()
        container = "rvx-minio-test"
        subprocess.run(["docker", "rm", "-f", container], capture_output=True, timeout=15)
        run = subprocess.run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                container,
                "-p",
                f"{port}:9000",
                "-e",
                "MINIO_ROOT_USER=minioadmin",
                "-e",
                "MINIO_ROOT_PASSWORD=minioadmin",
                "minio/minio:latest",
                "server",
                "/data",
            ],
            capture_output=True,
            timeout=120,
        )
        if run.returncode != 0:
            pytest.skip(f"could not start MinIO: {run.stderr.decode()[:200]}")
        # Wait for readiness
        deadline = time.time() + 45
        ready = False
        while time.time() < deadline and not ready:
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=2):
                    ready = True
            except OSError:
                time.sleep(1)
        if not ready:
            subprocess.run(["docker", "rm", "-f", container], capture_output=True, timeout=15)
            pytest.skip("MinIO never became ready")

        def cleanup() -> None:
            subprocess.run(["docker", "rm", "-f", container], capture_output=True, timeout=15)

        request.addfinalizer(cleanup)
        return f"http://127.0.0.1:{port}"

    def _store(self, endpoint: str) -> S3CompatibleArtifactStorage:
        store = S3CompatibleArtifactStorage(
            bucket="repoverix-test",
            access_key="minioadmin",
            secret_key="minioadmin",
            region="us-east-1",
            endpoint_url=endpoint,
        )
        # MinIO auto-creates buckets on first PUT in many setups; make it explicit via signed PUT
        try:
            store._request("PUT", "", payload=b"")  # bucket marker object ""
        except ArtifactStorageError:
            pass
        return store

    def test_put_get_round_trip(self, minio: str) -> None:
        store = self._store(minio)
        key = "archives/r9/archive.zip"
        payload = b"\x00\x01repo archive bytes" * 100
        assert store.put(key, payload) == key
        assert store.get(key) == payload

    def test_exists_and_delete(self, minio: str) -> None:
        store = self._store(minio)
        store.put("check/me.txt", b"hello")
        assert store.exists("check/me.txt") is True
        assert store.exists("check/absent.txt") is False
        store.delete("check/me.txt")
        assert store.exists("check/me.txt") is False

    def test_delete_prefix(self, minio: str) -> None:
        store = self._store(minio)
        for i in range(3):
            store.put(f"batch/{i}.bin", b"x" * 10)
        assert store.delete_prefix("batch/") == 3
        assert store.exists("batch/0.bin") is False

    def test_get_missing_raises(self, minio: str) -> None:
        store = self._store(minio)
        with pytest.raises(ArtifactStorageError):
            store.get("definitely/not/here")


class TestSelection:
    def test_default_is_local(self, tmp_path: Path) -> None:
        reset_artifact_storage()
        with MonkeyPatch.context() as mp:
            mp.setenv("REPOVERIX_ARTIFACT_STORAGE", "local")
            mp.setenv("REPOVERIX_REPOSITORY_STORAGE_DIR", str(tmp_path))
            from app.core import config as config_module

            config_module.get_settings.cache_clear()
            store = get_artifact_storage()
            assert isinstance(store, LocalArtifactStorage)
        reset_artifact_storage()

    def test_s3_requires_full_config(self) -> None:
        reset_artifact_storage()
        with MonkeyPatch.context() as mp:
            mp.setenv("REPOVERIX_ARTIFACT_STORAGE", "s3")
            mp.delenv("REPOVERIX_ARTIFACT_S3_BUCKET", raising=False)
            mp.delenv("AWS_ACCESS_KEY_ID", raising=False)
            from app.core import config as config_module

            config_module.get_settings.cache_clear()
            with pytest.raises(ArtifactStorageError):
                get_artifact_storage()
        reset_artifact_storage()
