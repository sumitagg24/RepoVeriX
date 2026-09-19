# RepoVeriX — File Upload, Content-Type & Malicious File Audit Report

**Audit Target**: File Ingestion, Extraction, Patch Application & Report Export Pipelines  
**Core Modules**: `app/analysis/ingest.py`, `app/api/routes/repositories.py`, `app/analysis/patchops.py`, `app/services/reporting.py`  
**Audit Scope**: Upload Streaming & Size Caps, MIME Sniffing vs Extensions, Zip Slip Traversal, Decompression Bombs, Malicious Content Handling, and Safe File Downloads.

---

## 1. File Ingestion Surface

| Path | Input Format | Ingestion Method | Hard Caps Enforced | Security Controls |
|---|---|---|---|---|
| `POST /repositories/zip` | `.zip` archive | Chunked streaming to disk | Max upload: 110 MB (`max_upload_bytes`) | Magic byte sniffing (`PK\x03\x04`), streaming without memory buffering |
| `POST /repositories/archive` | Remote `.zip` URL | HTTP streaming download | Max download: 100 MB (`max_repo_size_mb`) | SSRF preflight, connection pinning (`PinPlan`), size watchdog |
| `extract_archive()` | ZIP members | In-memory header inspection | Max total: 100 MB, Max per file: 1 MB, Max files: 5,000 | `PurePosixPath`, `is_relative_to` containment check, Zip Slip blocking |
| `apply_patch_to_directory()` | Unified diff patch | In-memory parsing | Single repository scope | Canonical path resolution, traversal escape blocking (`patch_escape`) |
| `GET /scans/{id}/report` | Markdown / JSON | Response generation | Bounded report size | `Content-Disposition: attachment`, sanitized filename, `nosniff` |

---

## 2. Magic-Byte Validation & MIME Hardening

- **Never Trust File Extension**: `POST /repositories/zip` does not rely on the client-provided `Content-Type` header or file extension.
- **Magic Byte Sniffing**: After streaming the archive to disk, the first 4 bytes are read and checked against standard ZIP signatures:
  ```python
  _ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06")
  head = dest.open("rb").read(4)
  if not head or not head.startswith(_ZIP_MAGIC):
      dest.unlink(missing_ok=True)
      await db.delete(repository)
      await db.commit()
      raise HTTPException(status_code=400, detail="File is not a valid ZIP archive")
  ```
- Non-ZIP payloads (HTML, polyglot scripts, executables) disguised as `.zip` are immediately unlinked and rejected.

---

## 3. Zip Slip & Decompression Bomb Defenses

### 3.1 Path Traversal Prevention
- During archive extraction in `app/analysis/ingest.py`:
  - Member paths are normalized using `PurePosixPath(info.filename)`.
  - Rejects absolute paths (`member.is_absolute()`) and path traversal segments (`".." in member.parts`).
  - Strict containment check verifies `(src / member).resolve().is_relative_to(src.resolve())`.

### 3.2 Decompression Resource Limits
- `max_files = 5,000`: Inode exhaustion protection.
- `max_per_file = 1,024 KB`: Individual file explosion protection.
- `max_repo_size_mb = 100 MB`: Total decompressed archive limit.
- Two-pass inspection validates counts and uncompressed size headers before writing any files to disk.

---

## 4. Safe File Download Architecture

1. **Report Downloads (`/scans/{id}/report?format=markdown`)**:
   - `Content-Disposition: attachment; filename="repoverix-report-{scan_id}.md"` enforces download rather than inline browser rendering, preventing HTML/XSS injection.
   - `Content-Type: text/markdown; charset=utf-8` or `application/json`.
2. **Global Browser Header**:
   - `X-Content-Type-Options: nosniff` header sent on all responses, blocking MIME-sniffing execution.
