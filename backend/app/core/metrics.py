"""Lightweight in-process metrics registry (Prometheus text exposition format).

No external dependency: counters/gauges/histograms are held in dicts guarded by
a lock and rendered on demand by :func:`render_metrics` (served at
``GET /metrics``). Only process-lifetime aggregations live here — anything
per-request state belongs in the request middleware, and per-*row* state
belongs in the database.

Thread-safety: the API process is mostly asyncio-single-threaded, but
background workers / sync middleware may touch the registry from other threads,
so every mutation takes a lock.
"""

from __future__ import annotations

import threading
import time

_MUTEX = threading.Lock()
# name -> labels-key -> value
_COUNTERS: dict[str, dict[tuple[tuple[str, str], ...], float]] = {}
_GAUGES: dict[str, dict[tuple[tuple[str, str], ...], float]] = {}

_DURATION_BUCKETS_SECONDS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0)

_PROCESS_START = time.time()


def _label_key(labels: dict[str, str]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((k, str(v)) for k, v in (labels or {}).items()))


def _fmt_labels(key: tuple[tuple[str, str], ...]) -> str:
    if not key:
        return ""
    return "{" + ",".join(f'{k}="{v}"' for k, v in key) + "}"


def inc(name: str, labels: dict[str, str] | None = None, amount: float = 1.0) -> None:
    """Increment a counter (created on first use)."""
    key = _label_key(labels)
    with _MUTEX:
        bucket = _COUNTERS.setdefault(name, {})
        bucket[key] = bucket.get(key, 0.0) + amount


def set_gauge(name: str, value: float, labels: dict[str, str] | None = None) -> None:
    """Set a gauge to an absolute value (created on first use)."""
    key = _label_key(labels)
    with _MUTEX:
        _GAUGES.setdefault(name, {})[key] = float(value)


def observe_duration(name: str, seconds: float, labels: dict[str, str] | None = None) -> None:
    """Record a duration into fixed buckets plus running sum/count."""
    key = _label_key(labels)
    with _MUTEX:
        hist = _COUNTERS.setdefault(name + "_bucket", {})
        for bound in _DURATION_BUCKETS_SECONDS:
            if seconds <= bound:
                bucket_key = key + (("le", str(bound)),)
                hist[bucket_key] = hist.get(bucket_key, 0.0) + 1.0
        inf_key = key + (("le", "+Inf"),)
        hist[inf_key] = hist.get(inf_key, 0.0) + 1.0
        sum_key = key + (("", ""),)  # synthetic marker so sums/counts keep separate label keys
        sums = _COUNTERS.setdefault(name + "_sum", {})
        sums[sum_key] = sums.get(sum_key, 0.0) + seconds
        counts = _COUNTERS.setdefault(name + "_count", {})
        counts[key] = counts.get(key, 0.0) + 1.0


def render_metrics() -> str:
    """Render every registered metric in Prometheus text format 0.0.4."""
    lines = [
        "# HELP repoverix_process_start_time_seconds Process start time (unix seconds).",
        "# TYPE repoverix_process_start_time_seconds gauge",
        f"repoverix_process_start_time_seconds {int(_PROCESS_START)}",
    ]
    with _MUTEX:
        # histogram families first (bucket/sum/count are counters)
        names = sorted(n for n in _COUNTERS if n.endswith("_bucket"))
        for name in names:
            base = name[: -len("_bucket")]
            lines.append(f"# TYPE {name} counter")
            for key, value in sorted(_COUNTERS[name].items()):
                lines.append(f"{name}{_fmt_labels(key)} {value:g}")
            for suffix in ("_sum", "_count"):
                full = base + suffix
                lines.append(f"# TYPE {full} counter")
                for key, value in sorted(_COUNTERS.get(full, {}).items()):
                    # drop the synthetic empty label pair used to separate sums
                    clean = tuple((k, v) for k, v in key if k != "")
                    lines.append(f"{full}{_fmt_labels(clean)} {value:g}")
        for name in sorted(n for n in _COUNTERS if not n.endswith(("_bucket", "_sum", "_count"))):
            lines.append(f"# TYPE {name} counter")
            for key, value in sorted(_COUNTERS[name].items()):
                lines.append(f"{name}{_fmt_labels(key)} {value:g}")
        for name in sorted(_GAUGES):
            lines.append(f"# TYPE {name} gauge")
            for key, value in sorted(_GAUGES[name].items()):
                lines.append(f"{name}{_fmt_labels(key)} {value:g}")
    return "\n".join(lines) + "\n"
