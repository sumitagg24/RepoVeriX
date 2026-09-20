#!/usr/bin/env python3
"""RepoVeriX Production Monitoring & Alerting Verification Script.

Probes /health, /ready, and /metrics to verify response time thresholds,
system status, and metric availability.
"""

import sys
import time
import json
import urllib.request
import urllib.error

def check_endpoint(url: str, expected_status: int = 200, timeout: float = 5.0) -> tuple[bool, int, float, str]:
    start = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RepoVeriX-Monitor/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            latency = time.time() - start
            body = response.read().decode("utf-8")
            return response.status == expected_status, response.status, latency, body
    except urllib.error.HTTPError as e:
        latency = time.time() - start
        return e.code == expected_status, e.code, latency, e.read().decode("utf-8")
    except Exception as e:
        latency = time.time() - start
        return False, 0, latency, str(e)

def run_monitoring_checks(base_url: str = "http://localhost:8000") -> dict:
    results = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_url": base_url,
        "checks": {},
        "overall_status": "PASS"
    }

    # 1. Liveness check
    ok, status, latency, body = check_endpoint(f"{base_url}/health")
    results["checks"]["liveness"] = {
        "status_code": status,
        "latency_seconds": round(latency, 4),
        "passed": ok and latency < 1.0,
        "details": body
    }
    if not (ok and latency < 1.0):
        results["overall_status"] = "FAIL"

    # 2. Readiness check
    ok, status, latency, body = check_endpoint(f"{base_url}/ready")
    results["checks"]["readiness"] = {
        "status_code": status,
        "latency_seconds": round(latency, 4),
        "passed": ok and latency < 2.0,
        "details": body
    }
    if not (ok and latency < 2.0):
        results["overall_status"] = "FAIL"

    # 3. Metrics check
    ok, status, latency, body = check_endpoint(f"{base_url}/metrics")
    metrics_valid = ok and "repoverix_http_requests_total" in body
    results["checks"]["metrics"] = {
        "status_code": status,
        "latency_seconds": round(latency, 4),
        "passed": metrics_valid,
        "has_prometheus_format": "repoverix_http_requests_total" in body
    }
    if not metrics_valid:
        results["overall_status"] = "FAIL"

    return results

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    report = run_monitoring_checks(url)
    print(json.dumps(report, indent=2))
    sys.exit(0 if report["overall_status"] == "PASS" else 1)
