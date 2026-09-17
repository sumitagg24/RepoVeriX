"""Deterministic website-audit analysis.

Every score and finding here is computed from *observed* crawl evidence —
never invented, never LLM-generated, and never presented as a Google/Bing/
OpenAI verdict. Dimensions with too little data return ``score: null`` and a
state of ``insufficient`` instead of a manufactured number.

State model (mirrors the repository evidence model):

- ``observed``        — the signal was directly measured on the target.
- ``recommendation``  — a cautious improvement derived from observed facts.
- ``insufficient``    — not enough data; no score manufactured.
"""

from __future__ import annotations

from typing import Any

# Hard limit on how long a summary string we embed in a finding.
_MAX_DETAIL = 300

_SECURITY_HEADERS = {
    "strict-transport-security": "HSTS",
    "content-security-policy": "CSP",
    "x-content-type-options": "X-Content-Type-Options",
    "x-frame-options": "X-Frame-Options",
    "referrer-policy": "Referrer-Policy",
    "permissions-policy": "Permissions-Policy",
}


def _finding(
    code: str,
    title: str,
    state: str,
    severity: str,
    detail: str,
    url: str | None = None,
    evidence_id: str | None = None,
) -> dict[str, Any]:
    finding: dict[str, Any] = {
        "code": code,
        "title": title,
        "state": state,
        "severity": severity,
        "detail": detail[:_MAX_DETAIL],
    }
    if url:
        finding["url"] = url
    if evidence_id:
        finding["evidence_id"] = evidence_id
    return finding


def _ok_pages(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [p for p in pages if p.get("error") is None and p.get("status")]


def analyze(pages: list[dict[str, Any]], robots: dict[str, Any]) -> dict[str, Any]:
    """Produce scores, summary, findings and evidence rows from crawl output."""
    evidence: list[dict[str, Any]] = []
    ok = _ok_pages(pages)

    def add_evidence(kind: str, url: str, detail: dict[str, Any]) -> str:
        eid = f"ev_{len(evidence) + 1:03d}"
        evidence.append({"id": eid, "kind": kind, "url": url, "detail": detail})
        return eid

    # ----------------------------------------------------------------- SEO
    seo_findings: list[dict[str, Any]] = []
    if ok:
        home = ok[0]
        title_ev = add_evidence("page_signal", home["url"], {"title": home.get("title")})
        desc_ev = add_evidence(
            "page_signal", home["url"], {"meta_description": (home.get("meta") or {}).get("description")}
        )
        title = home.get("title")
        if not title:
            seo_findings.append(
                _finding(
                    "seo_title_missing",
                    "Homepage <title> is missing",
                    "observed",
                    "high",
                    "The homepage served no <title> element.",
                    home["url"],
                    title_ev,
                )
            )
        elif not (10 <= len(title) <= 65):
            seo_findings.append(
                _finding(
                    "seo_title_length",
                    "Homepage <title> length is unusual",
                    "recommendation",
                    "medium",
                    f"Title is {len(title)} characters; 10–65 is the practical range.",
                    home["url"],
                    title_ev,
                )
            )
        description = (home.get("meta") or {}).get("description")
        if not description:
            seo_findings.append(
                _finding(
                    "seo_description_missing",
                    "Meta description missing",
                    "observed",
                    "medium",
                    'No <meta name="description"> on the homepage.',
                    home["url"],
                    desc_ev,
                )
            )
        elif not (50 <= len(description) <= 160):
            seo_findings.append(
                _finding(
                    "seo_description_length",
                    "Meta description length unusual",
                    "recommendation",
                    "low",
                    f"Description is {len(description)} chars; 50–160 renders best.",
                    home["url"],
                    desc_ev,
                )
            )
        h1s = (home.get("headings") or {}).get("h1", 0)
        if h1s != 1:
            seo_findings.append(
                _finding(
                    "seo_h1_count",
                    "Homepage has no unique H1",
                    "recommendation",
                    "medium",
                    f"Found {h1s} H1 elements; exactly one is the norm.",
                    home["url"],
                    title_ev,
                )
            )
        canonical = (home.get("meta") or {}).get("canonical")
        canonical_ev = add_evidence("page_signal", home["url"], {"canonical": canonical})
        if not canonical:
            seo_findings.append(
                _finding(
                    "seo_canonical_missing",
                    "No canonical link",
                    "recommendation",
                    "low",
                    "Self-referencing canonical avoids duplicate-URL signals.",
                    home["url"],
                    canonical_ev,
                )
            )
        og = (home.get("meta") or {}).get("og:title")
        if not og:
            seo_findings.append(
                _finding(
                    "seo_og_missing",
                    "Open Graph tags missing",
                    "recommendation",
                    "low",
                    "No og:title meta tag found; shares render bare.",
                    home["url"],
                    desc_ev,
                )
            )
        if not robots.get("found"):
            seo_findings.append(
                _finding(
                    "seo_robots_missing",
                    "robots.txt not found",
                    "recommendation",
                    "low",
                    "No robots.txt was served; crawlers fall back to defaults.",
                    None,
                    None,
                )
            )
        if not robots.get("sitemaps"):
            seo_findings.append(
                _finding(
                    "seo_sitemap_missing",
                    "No sitemap declared",
                    "recommendation",
                    "low",
                    "robots.txt declares no Sitemap: directive.",
                    None,
                    None,
                )
            )
    else:
        seo_findings.append(
            _finding(
                "crawl_failed",
                "No pages could be fetched",
                "insufficient",
                "high",
                "The crawl produced no usable page data; SEO signals cannot be assessed.",
                None,
                None,
            )
        )

    # --------------------------------------------------------- security headers
    sec_findings: list[dict[str, Any]] = []
    if ok:
        home = ok[0]
        present, missing = [], []
        for header, label in _SECURITY_HEADERS.items():
            value = (home.get("security_headers") or {}).get(header)
            ev = add_evidence("response_header", home["url"], {"header": header, "value": value})
            if value:
                present.append(label)
            else:
                missing.append(label)
                # Missing headers are *observations*, never called vulnerabilities.
                sec_findings.append(
                    _finding(
                        f"sec_header_missing_{header}",
                        f"{label} header not sent",
                        "recommendation",
                        "medium",
                        f"The response did not include {label}; it is a defence-in-depth control, "
                        "not proof of a vulnerability.",
                        home["url"],
                        ev,
                    )
                )
        if home.get("final_url", "").startswith("http://"):
            ev = add_evidence("response_header", home["url"], {"scheme": "http"})
            sec_findings.append(
                _finding(
                    "sec_no_https",
                    "Served over plain HTTP",
                    "observed",
                    "high",
                    "The final response used http:// — traffic is unencrypted.",
                    home["url"],
                    ev,
                )
            )
        if home.get("server"):
            ev = add_evidence("response_header", home["url"], {"server_banner": home["server"]})
            sec_findings.append(
                _finding(
                    "sec_server_banner",
                    "Server version banner exposed",
                    "observed",
                    "info",
                    f"Server: {home['server']} — consider trimming version details.",
                    home["url"],
                    ev,
                )
            )
        if home.get("mixed_content"):
            ev = add_evidence("page_signal", home["url"], {"mixed_content_links": home["mixed_content"]})
            sec_findings.append(
                _finding(
                    "sec_mixed_content",
                    "Mixed content on an HTTPS page",
                    "observed",
                    "medium",
                    f"{home['mixed_content']} http:// subresource/link(s) on an HTTPS page.",
                    home["url"],
                    ev,
                )
            )
        insecure_cookies = home.get("cookies") or []
        if insecure_cookies:
            ev = add_evidence(
                "response_header", home["url"], {"cookies_without_secure_flag": insecure_cookies}
            )
            sec_findings.append(
                _finding(
                    "sec_cookie_flags",
                    "Cookies set without Secure flag",
                    "observed",
                    "medium",
                    f"Set-Cookie for {', '.join(insecure_cookies[:3])} lacked the Secure attribute.",
                    home["url"],
                    ev,
                )
            )
    else:
        sec_findings.append(
            _finding(
                "sec_crawl_failed",
                "Security headers not observable",
                "insufficient",
                "info",
                "No responses were received, so headers cannot be assessed.",
                None,
                None,
            )
        )

    # ------------------------------------------------------------- accessibility
    a11y_findings: list[dict[str, Any]] = []
    if ok:
        total_images = sum(p.get("images_total", 0) for p in ok)
        missing_alt = sum(p.get("images_missing_alt", 0) for p in ok)
        if total_images:
            ev = add_evidence(
                "page_signal", ok[0]["url"], {"images_total": total_images, "images_missing_alt": missing_alt}
            )
            ratio = missing_alt / total_images
            a11y_findings.append(
                _finding(
                    "a11y_img_alt",
                    "Images missing alt text",
                    "observed",
                    "high" if ratio > 0.3 else ("medium" if ratio else "low"),
                    f"{missing_alt} of {total_images} <img> elements have no alt attribute.",
                    ok[0]["url"],
                    ev,
                )
            )
        else:
            a11y_findings.append(
                _finding(
                    "a11y_no_images",
                    "No images encountered",
                    "insufficient",
                    "info",
                    "No <img> elements were observed on crawled pages.",
                    None,
                    None,
                )
            )
        for p in ok:
            if not (p.get("lang")):
                a11y_findings.append(
                    _finding(
                        "a11y_html_lang",
                        "html lang attribute missing",
                        "observed",
                        "medium",
                        "The <html> element declares no language.",
                        p["url"],
                        None,
                    )
                )
                break
        if not any((p.get("meta") or {}).get("viewport") for p in ok):
            a11y_findings.append(
                _finding(
                    "a11y_viewport",
                    "No viewport meta tag",
                    "observed",
                    "medium",
                    'No <meta name="viewport"> found; mobile rendering is uncontrolled.',
                    ok[0]["url"],
                    None,
                )
            )
    else:
        a11y_findings.append(
            _finding(
                "a11y_crawl_failed",
                "Accessibility signals not observable",
                "insufficient",
                "info",
                "No pages were fetched, so DOM-level accessibility checks cannot run.",
                None,
                None,
            )
        )

    # ---------------------------------------------------------------- performance
    perf_findings: list[dict[str, Any]] = []
    scores = {
        "technical_seo": None,
        "security_posture": None,
        "accessibility": None,
        "performance": None,
        "ai_search_readiness": None,
        "content_quality": None,
        "technical_health": None,
    }
    if ok:
        latencies = [p.get("response_ms", 0) for p in ok if p.get("response_ms")]
        avg_latency = int(sum(latencies) / len(latencies)) if latencies else None
        total_bytes = sum(p.get("html_bytes", 0) for p in ok)
        ev = add_evidence(
            "timing", ok[0]["url"], {"avg_response_ms": avg_latency, "total_html_bytes": total_bytes}
        )
        if avg_latency is not None:
            perf_findings.append(
                _finding(
                    "perf_response_time",
                    "Average server response time",
                    "observed",
                    "high" if avg_latency > 2500 else ("medium" if avg_latency > 1200 else "info"),
                    f"{avg_latency} ms average across {len(latencies)} fetched page(s).",
                    ok[0]["url"],
                    ev,
                )
            )
        if total_bytes > 1_500_000:
            perf_findings.append(
                _finding(
                    "perf_html_weight",
                    "HTML payload is large",
                    "observed",
                    "medium",
                    f"{total_bytes // 1024} KiB of HTML across crawled pages; check compression.",
                    ok[0]["url"],
                    ev,
                )
            )
        scores["performance"] = _perf_score(avg_latency, total_bytes, len(ok))
    else:
        perf_findings.append(
            _finding(
                "perf_crawl_failed",
                "Performance not measurable",
                "insufficient",
                "info",
                "No responses were received; no timing data exists.",
                None,
                None,
            )
        )

    # ----------------------------------------------------------- AI search readiness
    ai_findings: list[dict[str, Any]] = []
    if ok:
        home = ok[0]
        signals = {
            "structured_data": sum(p.get("json_ld_count", 0) for p in ok) > 0,
            "meta_description": bool((home.get("meta") or {}).get("description")),
            "open_graph": bool((home.get("meta") or {}).get("og:title")),
            "canonical": bool((home.get("meta") or {}).get("canonical")),
            "lang_declared": bool(home.get("lang")),
            "single_h1": (home.get("headings") or {}).get("h1", 0) == 1,
            "robots_found": bool(robots.get("found")),
        }
        ev = add_evidence("aggregate", home["url"], {"ai_signals": signals})
        positives = sum(1 for v in signals.values() if v)
        scores["ai_search_readiness"] = int(round(positives / len(signals) * 100))
        missing = [k for k, v in signals.items() if not v]
        ai_findings.append(
            _finding(
                "ai_signals_summary",
                "AI-search readiness signals",
                "observed",
                "info",
                f"{positives}/{len(signals)} observable signals present"
                + (f"; missing: {', '.join(missing)}" if missing else "."),
                home["url"],
                ev,
            )
        )
        ai_findings.append(
            _finding(
                "ai_disclaimer",
                "Analytical score, not a ranking",
                "recommendation",
                "info",
                "This reflects observable technical signals only — not how any search "
                "or AI system ranks the site.",
                None,
                None,
            )
        )
    else:
        ai_findings.append(
            _finding(
                "ai_crawl_failed",
                "AI-readiness not observable",
                "insufficient",
                "info",
                "No pages were fetched, so content signals cannot be assessed.",
                None,
                None,
            )
        )

    # ------------------------------------------------------------------- scores
    scores["technical_seo"] = _seo_score(ok, seo_findings)
    scores["security_posture"] = _security_score(ok)
    scores["accessibility"] = _a11y_score(ok, a11y_findings)
    scores["technical_health"] = _health_score(pages, ok)

    summary = {
        "pages_crawled": len(ok),
        "pages_attempted": len(pages),
        "robots_found": bool(robots.get("found")),
        "sitemaps": robots.get("sitemaps", []),
        "average_response_ms": next(
            (int(sum(p.get("response_ms", 0) for p in ok) / len(ok)) for ok in [ok] if ok), None
        ),
    }
    return {
        "scores": scores,
        "summary": summary,
        "findings": seo_findings + sec_findings + a11y_findings + perf_findings + ai_findings,
        "evidence": evidence,
    }


def _seo_score(ok: list[dict[str, Any]], findings: list[dict[str, Any]]) -> int | None:
    if not ok:
        return None
    penalties = {"high": 25, "medium": 12, "low": 5}
    score = 100
    for f in findings:
        if f["state"] == "insufficient":
            continue
        score -= penalties.get(f["severity"], 5)
    return max(0, min(100, score))


def _security_score(ok: list[dict[str, Any]]) -> int | None:
    if not ok:
        return None
    home = ok[0]
    present = sum(1 for h in _SECURITY_HEADERS if (home.get("security_headers") or {}).get(h))
    score = int(present / len(_SECURITY_HEADERS) * 80)
    if home.get("final_url", "").startswith("https://"):
        score += 20
    return max(0, min(100, score))


def _a11y_score(ok: list[dict[str, Any]], findings: list[dict[str, Any]]) -> int | None:
    if not ok:
        return None
    penalties = {"high": 20, "medium": 10, "low": 4}
    score = 100
    for f in findings:
        if f["state"] == "insufficient":
            continue
        score -= penalties.get(f["severity"], 4)
    return max(0, min(100, score))


def _perf_score(avg_latency: int | None, total_bytes: int, pages: int) -> int | None:
    if avg_latency is None:
        return None
    score = 100
    if avg_latency > 2500:
        score -= 45
    elif avg_latency > 1200:
        score -= 25
    elif avg_latency > 600:
        score -= 10
    if total_bytes > 1_500_000:
        score -= 15
    elif total_bytes > 700_000:
        score -= 8
    if pages == 0:
        return None
    return max(0, min(100, score))


def _health_score(pages: list[dict[str, Any]], ok: list[dict[str, Any]]) -> int | None:
    if not pages:
        return None
    good = len(ok)
    broken = sum(1 for p in pages if p.get("status") and p.get("status") >= 400)
    errors = sum(1 for p in pages if p.get("error") and not p.get("robots_disallowed"))
    score = 100 - broken * 15 - errors * 8
    if good == 0:
        score = min(score, 20)
    return max(0, min(100, score))
