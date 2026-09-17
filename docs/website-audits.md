# Website Audits

RepoVeriX audits public websites **passively**: it fetches what any visitor
could see and analyses the observable surface. It never authenticates to the
target, never runs exploits, never fuzzes, and never sends destructive
requests.

## Safety model

| Control | Implementation |
| --- | --- |
| Same-origin crawl | The crawler never follows a link off the registered hostname. |
| SSRF gate | Every request (and every redirect hop) is preflighted through `app.core.ssrf.preflight_and_pin`: private/loopback/link-local/metadata ranges are rejected and the connection is pinned to the validated IP (DNS-rebinding safe). |
| Scheme/port allow-list | Only `http`/`https` on ports 80/443; userinfo in URLs rejected. |
| Bounded crawl | Max 25 pages (default 10), max depth 3 (default 2), 2 MiB response cap per page, 15 s request timeout, 1 s politeness delay between same-origin requests. |
| robots.txt | Fetched first; disallowed paths are skipped and reported, never crawled. |
| One live audit per website | A 409 is returned if an audit is already pending/running — targets are never crawled in parallel. |
| Owner-scoped | Websites are personal resources; a non-owner receives the same 404 as an anonymous request (IDOR guard). |

## What is measured

- **Crawl**: same-origin pages, status codes, redirect targets, content types,
  response times, HTML size.
- **Technical SEO**: title presence/length, meta description, canonical, H1
  count, Open Graph tags, robots.txt, sitemap declarations.
- **Security posture** (passive observation only): HTTPS, HSTS, CSP,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, mixed content, cookie flags, server banner.
- **Accessibility signals**: `alt` attributes, `html lang`, viewport meta.
  Automated DOM checks only — this is not a WCAG audit.
- **Performance observations**: measured response times and HTML weight.
  This is *not* a Lighthouse run and produces no Core Web Vitals numbers.
- **AI-search readiness**: structured data (JSON-LD), meta description,
  Open Graph, canonical, language declaration, single H1, robots.txt.
- **Technical health**: fetch success rate, broken pages, crawl errors.

## Scoring honesty

Dimension scores (0–100) are **RepoVeriX analytical scores** computed
deterministically from the evidence captured during the crawl
(`app/analysis/webanalyze.py`). They are not Google, Bing or AI-platform
rankings, and a high score is not a security certification.

Where there is not enough data, the score is `null` and findings carry the
`insufficient` state — RepoVeriX never manufactures a number from zero
evidence.

## Finding states

| State | Meaning |
| --- | --- |
| `observed` | The signal was directly measured on the target. |
| `recommendation` | A cautious improvement derived from observed facts (missing headers are recommendations, never "vulnerabilities"). |
| `insufficient` | Not enough data; no conclusion drawn. |

Every finding links to evidence rows (`page_signal`, `response_header`,
`timing`, `aggregate`) that capture what was actually observed, on which URL.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/websites` | Register a website (SSRF-validated, idempotent). |
| `GET` | `/api/v1/websites` | List the caller's websites. |
| `DELETE` | `/api/v1/websites/{id}` | Delete a website and its audits. |
| `POST` | `/api/v1/websites/{id}/audits` | Start a passive audit (202, runs in background). |
| `GET` | `/api/v1/websites/{id}/audits` | Audit history. |
| `GET` | `/api/v1/websites/{id}/audits/{audit_id}` | Scores, findings, evidence, crawled pages. |

## Data model

- `websites` — owner, url, hostname, label, last_audit_at (migration `006`).
- `website_audits` — status machine `pending → running → complete | failed`,
  limits, page counts, timing, and JSON payloads: `scores`, `summary`,
  `pages`, `findings`, `evidence`.

The UI lives at `/websites` (list + register) and `/websites/[id]` (latest
audit detail with live polling while the audit runs).
