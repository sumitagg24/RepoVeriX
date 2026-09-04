"""Structured logging helpers.

Log lines carry a ``scan_id`` / ``stage`` context so every pipeline step can be
traced: ``scan_id=abc stage=static_analysis status=started``.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

logger = logging.getLogger("repoverix")


def setup_logging(debug: bool = False) -> None:
    """Configure the root ``repoverix`` logger once (idempotent)."""
    if logger.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if debug else logging.INFO)
    logger.propagate = False


def log_scan(scan_id: str, stage: str, status: str, message: str = "", **extra: Any) -> None:
    """Emit a structured scan log line."""
    fields: dict[str, Any] = {"scan_id": scan_id, "stage": stage, "status": status}
    fields.update(extra)
    suffix = (" " + message) if message else ""
    logger.info("%s%s", json.dumps(fields, default=str), suffix)
