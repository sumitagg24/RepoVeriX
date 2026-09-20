#!/usr/bin/env python3
"""RepoVeriX Production Performance Benchmark & Capacity Tuning Script.

Simulates load spikes against API endpoints, tracking response time percentiles (p50, p95, p99).
"""

import sys
import time
import json
import statistics
import urllib.request

def run_performance_benchmark(target_url: str = "http://localhost:8000/health", requests_count: int = 50) -> dict:
    latencies = []
    successes = 0
    failures = 0

    start_time = time.time()
    for _ in range(requests_count):
        req_start = time.time()
        try:
            req = urllib.request.Request(target_url, headers={"User-Agent": "RepoVeriX-Benchmark/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                lat = time.time() - req_start
                latencies.append(lat)
                if resp.status == 200:
                    successes += 1
                else:
                    failures += 1
        except Exception:
            latencies.append(time.time() - req_start)
            failures += 1

    total_time = time.time() - start_time
    sorted_lat = sorted(latencies) if latencies else [0]
    p50 = sorted_lat[int(len(sorted_lat) * 0.50)]
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if len(sorted_lat) >= 20 else sorted_lat[-1]
    p99 = sorted_lat[-1]

    passed = (failures == 0) and (p95 < 0.500)
    return {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "target_url": target_url,
        "total_requests": requests_count,
        "successful_requests": successes,
        "failed_requests": failures,
        "throughput_req_per_sec": round(requests_count / total_time, 2) if total_time > 0 else 0,
        "latency_percentiles": {
            "p50_seconds": round(p50, 4),
            "p95_seconds": round(p95, 4),
            "p99_seconds": round(p99, 4),
            "mean_seconds": round(statistics.mean(sorted_lat), 4)
        },
        "passed": passed,
        "overall_status": "PASS" if passed else "FAIL"
    }

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/health"
    bench_report = run_performance_benchmark(url)
    print(json.dumps(bench_report, indent=2))
    sys.exit(0 if bench_report["overall_status"] == "PASS" else 1)
