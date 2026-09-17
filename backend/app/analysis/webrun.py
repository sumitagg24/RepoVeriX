"""Website-audit background runner.

State machine: ``pending → running → complete | failed``. The runner never
raises out of the background task: any failure is recorded on the audit row
so the UI can show an honest failed state.
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from app.analysis.webanalyze import analyze
from app.analysis.webcrawler import UnsafeURLError, crawl_site, normalize_url
from app.core.metrics import inc
from app.db.models import Website, WebsiteAudit

_logger = logging.getLogger("repoverix.webaudit")


async def run_website_audit(SessionLocal, audit_id: uuid.UUID) -> None:
    """Execute one passive website audit end to end."""
    async with SessionLocal() as session:
        audit = (
            await session.execute(select(WebsiteAudit).where(WebsiteAudit.id == audit_id))
        ).scalar_one_or_none()
        if audit is None:
            _logger.error("website audit %s vanished before run", audit_id)
            return
        audit.status = "running"
        audit.started_at = datetime.now(UTC)
        await session.commit()
        website = (await session.execute(select(Website).where(Website.id == audit.website_id))).scalar_one()

        try:
            origin = normalize_url(website.url)
            crawl = await crawl_site(origin, max_pages=audit.max_pages, max_depth=audit.max_depth)
            result = analyze(crawl["pages"], crawl["robots"])

            audit.status = "complete"
            audit.pages_crawled = crawl["crawled"]
            audit.scores = result["scores"]
            audit.summary = {
                **result["summary"],
                "origin": origin,
                "robots": crawl["robots"],
            }
            audit.pages = crawl["pages"]
            audit.findings = result["findings"]
            audit.evidence = result["evidence"]
            website.last_audit_at = datetime.now(UTC)
            inc("repoverix_webaudits_total", {"status": "complete"})
        except UnsafeURLError as exc:
            audit.status = "failed"
            audit.error = f"unsafe target: {exc}"
            inc("repoverix_webaudits_total", {"status": "failed"})
        except Exception as exc:  # noqa: BLE001 - audit failures must be recorded, not raised
            audit.status = "failed"
            audit.error = f"{type(exc).__name__}: {exc}"
            inc("repoverix_webaudits_total", {"status": "failed"})
            _logger.exception("website audit %s failed", audit_id)
        finally:
            audit.finished_at = datetime.now(UTC)
            await session.commit()
