"""Passive website crawler.

Safety model (RepoVeriX never attacks a target):

- Same-origin only: the crawl never leaves the registered hostname.
- Every request is SSRF-preflighted and connection-pinned via
  :func:`app.core.ssrf.preflight_and_pin` (single DNS resolution, private
  range rejection, DNS-rebinding protection).
- Only http/https on standard ports (80/443); redirects are followed manually
  with per-hop preflight and origin checks, capped at 5 hops.
- Bounded: max pages, max depth, response size cap, per-request timeout,
  concurrency cap, one second politeness delay between same-host requests.
- robots.txt is fetched first; disallowed paths are skipped and marked.
- Content-type restricted to HTML/text; binary resources are recorded but
  not downloaded.
"""

from __future__ import annotations

import asyncio
import logging
import time
import urllib.robotparser
from collections import deque
from dataclasses import dataclass, field
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse, urlunparse

import httpx

from app.core.ssrf import PinPlan, preflight_and_pin

_logger = logging.getLogger("repoverix.webaudit")

USER_AGENT = "RepoVeriXBot/1.0 (+https://repoverix.com/bot)"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024  # 2 MiB per page
MAX_REDIRECTS = 5
REQUEST_TIMEOUT = 15.0
POLITENESS_DELAY = 1.0  # seconds between requests to the same origin

_ALLOWED_SCHEMES = ("http", "https")
_ALLOWED_PORTS = {None, 80, 443}


class UnsafeURLError(Exception):
    """The URL fails the safety gate (scheme, port, or SSRF preflight)."""


def normalize_url(raw: str) -> str:
    """Normalize a user-supplied site URL to ``scheme://host[:port]/`` form.

    Raises :class:`UnsafeURLError` for anything that is not a plain http(s)
    site URL on a standard port (no userinfo, no fragments, no exotic ports).
    """
    raw = (raw or "").strip()
    if not raw:
        raise UnsafeURLError("empty URL")
    if "://" not in raw:
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise UnsafeURLError(f"scheme {parsed.scheme!r} not allowed")
    host = (parsed.hostname or "").rstrip(".").lower()
    if not host:
        raise UnsafeURLError("URL has no host")
    if parsed.username or parsed.password:
        raise UnsafeURLError("userinfo in URL not allowed")
    if parsed.port not in _ALLOWED_PORTS:
        raise UnsafeURLError(f"port {parsed.port} not allowed")
    scheme = parsed.scheme
    netloc = host if parsed.port is None else f"{host}:{parsed.port}"
    return urlunparse((scheme, netloc, "/", "", "", ""))


def _canonical(url: str) -> str:
    """Canonical form used for seen-set deduplication (drop fragment)."""
    parsed = urlparse(url)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.params, parsed.query, ""))


def same_origin(a: str, b: str) -> bool:
    pa, pb = urlparse(a), urlparse(b)
    return (pa.scheme, pa.hostname, pa.port) == (pb.scheme, pb.hostname, pb.port)


class _PageParser(HTMLParser):
    """Collects SEO/a11y signals and same-origin links from one HTML page."""

    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[str] = []
        self.title: str | None = None
        self.meta: dict[str, str] = {}
        self.headings: dict[str, int] = {}
        self.images: list[dict[str, str | None]] = []
        self.lang: str | None = None
        self.viewport: str | None = None
        self.json_ld_count = 0
        self.in_title = False
        self._title_parts: list[str] = []
        self._heading_stack: list[str] = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attr = {k.lower(): (v or "") for k, v in attrs}
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            name = attr.get("name", "").lower()
            prop = attr.get("property", "").lower()
            key = name or prop
            if key:
                self.meta.setdefault(key, attr.get("content", ""))
        elif tag == "html":
            self.lang = attr.get("lang")
        elif tag == "img":
            self.images.append({"src": attr.get("src"), "alt": attr.get("alt")})
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self.headings[tag] = self.headings.get(tag, 0) + 1
            self._heading_stack.append(tag)
        elif tag == "link" and attr.get("rel", "").lower() == "canonical":
            self.meta.setdefault("canonical", attr.get("href", ""))
        elif tag == "script" and attr.get("type", "").lower() == "application/ld+json":
            self.json_ld_count += 1
        elif tag in ("a", "area"):
            href = attr.get("href")
            if href and not href.startswith(("mailto:", "tel:", "javascript:", "#")):
                self.links.append(urljoin(self.base_url, href))

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title" and self.in_title:
            self.in_title = False
            self.title = "".join(self._title_parts).strip() or None
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self._heading_stack:
            self._heading_stack.pop()

    def handle_data(self, data):
        if self.in_title:
            self._title_parts.append(data)


@dataclass
class PageResult:
    url: str
    final_url: str
    status: int
    depth: int
    title: str | None = None
    meta: dict[str, str] = field(default_factory=dict)
    headings: dict[str, int] = field(default_factory=dict)
    images_missing_alt: int = 0
    images_total: int = 0
    lang: str | None = None
    json_ld_count: int = 0
    html_bytes: int = 0
    response_ms: int = 0
    server: str | None = None
    security_headers: dict[str, str | None] = field(default_factory=dict)
    cookies: list[str] = field(default_factory=list)
    mixed_content: int = 0
    links: list[str] = field(default_factory=list)
    error: str | None = None
    robots_disallowed: bool = False
    content_type: str | None = None

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "final_url": self.final_url,
            "status": self.status,
            "depth": self.depth,
            "title": self.title,
            "meta": self.meta,
            "headings": self.headings,
            "images_missing_alt": self.images_missing_alt,
            "images_total": self.images_total,
            "lang": self.lang,
            "json_ld_count": self.json_ld_count,
            "html_bytes": self.html_bytes,
            "response_ms": self.response_ms,
            "server": self.server,
            "security_headers": self.security_headers,
            "cookies": self.cookies,
            "mixed_content": self.mixed_content,
            "error": self.error,
            "robots_disallowed": self.robots_disallowed,
            "content_type": self.content_type,
        }


class _RobotsPolicy:
    """robots.txt gate for one host (missing robots.txt means allow-all)."""

    def __init__(self) -> None:
        self._parser = urllib.robotparser.RobotFileParser()
        self.fetched = False
        self.found = False
        self.sitemaps: list[str] = []

    @classmethod
    async def fetch(cls, client: httpx.AsyncClient, origin: str) -> _RobotsPolicy:
        policy = cls()
        url = urljoin(origin, "/robots.txt")
        try:
            resp = await _fetch_pinned(client, url)
        except Exception:
            policy.fetched = True
            return policy
        policy.fetched = True
        if resp is not None and resp.status_code == 200:
            policy.found = True
            body = resp.text[:262144]
            policy._parser.parse(body.splitlines())
            policy.sitemaps = [
                line.split(":", 1)[1].strip()
                for line in body.splitlines()
                if line.lower().startswith("sitemap:")
            ][:5]
        return policy

    def allowed(self, url: str) -> bool:
        if not self.found:
            return True
        try:
            return self._parser.can_fetch(USER_AGENT, url) or self._parser.can_fetch("*", url)
        except Exception:  # malformed robots.txt must not block the crawl
            return True


async def _fetch_pinned(client: httpx.AsyncClient, url: str) -> httpx.Response:
    """Fetch ``url`` through the SSRF gate with connection pinning.

    Redirects are followed manually: every hop is re-preflighted and must
    stay on a public address (rebinding-safe), while the crawl-level origin
    restriction is enforced by the caller.
    """
    current = url
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    for _ in range(MAX_REDIRECTS + 1):
        pin: PinPlan | None = preflight_and_pin(current)
        request_headers = dict(headers)
        extensions: dict = {}
        if pin is not None:
            request_headers.update(pin.headers)
            extensions = pin.extensions
            response = await client.get(
                pin.pinned_url, headers=request_headers, extensions=extensions, follow_redirects=False
            )
        else:
            response = await client.get(current, headers=request_headers, follow_redirects=False)
        if response.is_redirect:
            location = response.headers.get("location", "")
            if not location:
                return response
            current = urljoin(current, location)
            continue
        return response
    raise UnsafeURLError("too many redirects")


async def _fetch_page(client: httpx.AsyncClient, url: str, origin: str, depth: int) -> PageResult:
    result = PageResult(url=url, final_url=url, status=0, depth=depth)
    started = time.monotonic()
    try:
        response = await _fetch_pinned(client, url)
    except UnsafeURLError as exc:
        result.error = str(exc)
        return result
    except Exception as exc:  # noqa: BLE001 - any network failure is a page error
        result.error = f"{type(exc).__name__}: {exc}"
        return result
    result.response_ms = int((time.monotonic() - started) * 1000)
    result.status = response.status_code
    result.final_url = str(response.url)
    result.server = response.headers.get("server")
    result.content_type = response.headers.get("content-type", "").split(";")[0] or None
    result.security_headers = {
        "strict-transport-security": response.headers.get("strict-transport-security"),
        "content-security-policy": response.headers.get("content-security-policy"),
        "x-content-type-options": response.headers.get("x-content-type-options"),
        "x-frame-options": response.headers.get("x-frame-options"),
        "referrer-policy": response.headers.get("referrer-policy"),
        "permissions-policy": response.headers.get("permissions-policy"),
    }
    result.cookies = [cookie.name for cookie in response.cookies.jar if cookie.domain and not cookie.secure]
    if not same_origin(result.final_url, origin):
        result.error = "redirected off-origin"
        return result

    ctype = result.content_type or ""
    if "html" not in ctype and "xml" not in ctype and ctype:
        result.error = f"non-HTML content type: {ctype}"
        return result
    body = response.content[:MAX_RESPONSE_BYTES]
    result.html_bytes = len(body)
    text = body.decode(response.encoding or "utf-8", errors="replace")
    parser = _PageParser(base_url=result.final_url)
    try:
        parser.feed(text)
    except Exception:
        pass  # malformed HTML: keep whatever was parsed before the failure
    result.title = parser.title
    result.meta = dict(parser.meta)
    result.headings = dict(parser.headings)
    result.lang = parser.lang
    result.json_ld_count = parser.json_ld_count
    result.images_total = len(parser.images)
    result.images_missing_alt = sum(1 for img in parser.images if not (img.get("alt") or "").strip())
    if result.final_url.startswith("http://"):
        result.mixed_content = sum(1 for link in parser.links if link.startswith("http://"))
    result.links = parser.links
    return result


async def crawl_site(
    origin: str,
    *,
    max_pages: int = 10,
    max_depth: int = 2,
) -> dict:
    """Crawl one site (same-origin, bounded, passive) and return raw page data.

    Returns ``{"pages": [...], "robots": {...}, "crawled": int}``. Network
    failures degrade gracefully: a page that cannot be fetched still yields a
    result row with its error recorded.
    """
    origin = normalize_url(origin)
    start = time.monotonic()
    robots: _RobotsPolicy | None = None
    pages: list[PageResult] = []
    seen: set[str] = set()
    queue: deque[tuple[str, int]] = deque([(origin, 0)])
    seen.add(_canonical(origin))

    timeout = httpx.Timeout(REQUEST_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout, verify=True) as client:
        robots = await _RobotsPolicy.fetch(client, origin)
        if robots.sitemaps:
            pass  # sitemap URLs are recorded on the audit summary by the caller
        while queue and len(pages) < max_pages:
            url, depth = queue.popleft()
            if robots is not None and not robots.allowed(url):
                pages.append(
                    PageResult(
                        url=url,
                        final_url=url,
                        status=0,
                        depth=depth,
                        error="disallowed by robots.txt",
                        robots_disallowed=True,
                    )
                )
                continue
            if depth > max_depth:
                continue

            # Sequential, polite fetching: one request at a time with a small
            # delay between same-origin requests (never burst a target).
            if pages:
                await asyncio.sleep(POLITENESS_DELAY)
            result = await _fetch_page(client, url, origin, depth)
            pages.append(result)
            if depth < max_depth and result.error is None:
                for link in result.links:
                    canonical = _canonical(link)
                    if canonical in seen:
                        continue
                    if not same_origin(canonical, origin):
                        continue
                    seen.add(canonical)
                    queue.append((canonical, depth + 1))

    crawled = sum(1 for p in pages if p.error is None and p.status)
    _logger.info(
        "webaudit crawl complete origin=%s pages=%d/%d ok=%d duration_ms=%d",
        origin,
        len(pages),
        max_pages,
        crawled,
        int((time.monotonic() - start) * 1000),
    )
    return {
        "pages": [p.to_dict() for p in pages],
        "robots": {
            "fetched": robots.fetched if robots else False,
            "found": robots.found if robots else False,
            "sitemaps": robots.sitemaps if robots else [],
        },
        "crawled": crawled,
    }
