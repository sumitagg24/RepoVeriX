import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Changelog',
  description:
    'What shipped in RepoVeriX: security hardening, the full audit pipeline, production reliability, team features and sharing.',
  alternates: { canonical: '/changelog' },
  openGraph: {
    title: 'Changelog - RepoVeriX',
    description: 'What shipped in RepoVeriX.',
    url: `${SITE_URL}/changelog`,
  },
};

interface Entry {
  date: string;
  title: string;
  tags: string[];
  items: { label: string; detail: string }[];
}

const ENTRIES: Entry[] = [
  {
    date: '2026-09-07',
    title: 'CSP, teams & sharing',
    tags: ['security', 'teams', 'sharing'],
    items: [
      {
        label: 'Content-Security-Policy',
        detail:
          'Full per-request CSP with a nonce pipeline (script-src strict-dynamic) across every page; report-only rollout flag available.',
      },
      {
        label: 'Organizations & RBAC',
        detail:
          'Create organizations, invite members with member/admin/owner roles, and share repositories with server-side access checks on every route.',
      },
      {
        label: 'API tokens for CI',
        detail:
          'Create scoped tokens (hashed at rest) to run change audits and scans from CI pipelines.',
      },
      {
        label: 'Automatic re-analysis',
        detail:
          'Push webhooks for GitHub and GitLab with HMAC signature verification, delivery deduplication and idempotent re-scans of the default branch.',
      },
      {
        label: 'Fix → re-analyze → verify chain',
        detail:
          'One call generates a repair for a finding, re-runs the detectors and returns the verification verdict.',
      },
      {
        label: 'Finding feedback',
        detail:
          'Mark findings correct / incorrect / already fixed — verdicts fold into rule statistics for measured false-positive reduction.',
      },
      {
        label: 'Shareable reports',
        detail:
          'Generate a secret-URL, sanitised report of any scan — no source code, no tokens — with revocation, optional expiry and view counts.',
      },
      {
        label: 'Blog & changelog',
        detail: 'This changelog, the engineering blog, and GitHub/GitLab integration pages.',
      },
    ],
  },
  {
    date: '2026-09-06',
    title: 'Production reliability',
    tags: ['observability', 'performance', 'privacy'],
    items: [
      {
        label: 'Observability',
        detail:
          'Structured JSON access logs with request IDs echoed on every response, plus a Prometheus /metrics endpoint (request rate, latency histogram, in-flight gauge, job counters).',
      },
      {
        label: 'Database performance',
        detail:
          'Composite indexes on the hot read paths (scans by repository and date, findings by scan/severity/status, evidence by finding) and idempotency keys on scan creation.',
      },
      {
        label: 'Privacy controls',
        detail:
          'Account data export and full account deletion (cascading storage cleanup), plus a database backup CLI with integrity and retention checks.',
      },
      {
        label: 'Caching',
        detail:
          'Repository insights cached per commit; cache headers on immutable scan artifacts (SARIF, reports).',
      },
    ],
  },
  {
    date: '2026-09-05',
    title: 'Security hardening',
    tags: ['security'],
    items: [
      {
        label: 'SSRF protection',
        detail:
          'Git clones and archive downloads now block private, loopback, link-local and cloud-metadata destinations — literal IPs and DNS-resolved hosts — with redirect preflight.',
      },
      {
        label: 'Token encryption',
        detail:
          'OAuth provider tokens are encrypted at rest (Fernet); ciphertext without the key refuses to decrypt.',
      },
      {
        label: 'Sandbox hardening',
        detail:
          'Verification containers run with PID limits, no-new-privileges, stripped host env and hard timeouts.',
      },
      {
        label: 'AI safety',
        detail:
          'Prompt-injection guard policy pinned into the LLM system prompt with guarded JSON completion; repository content is data, never instructions.',
      },
      {
        label: 'Rate limiting',
        detail:
          'Tiered limits: auth (per-IP and per-account with exponential backoff), public, user and action tiers.',
      },
    ],
  },
  {
    date: '2026-09-04',
    title: 'The full audit pipeline',
    tags: ['features'],
    items: [
      {
        label: 'Core analysis',
        detail:
          'Repository ingestion (git, archive, ZIP), AST/symbol parsing, static detectors, repository graph, evidence engine.',
      },
      {
        label: 'Validation & verification',
        detail:
          'Counterexample-based finding validation (VERIFIED / PROBABLE / REJECTED), reproduction-test generation and the Proof-of-Fix pipeline with deterministic verdicts.',
      },
      {
        label: 'Repository intelligence',
        detail:
          'Change impact & risk (0–100), PR auditing, regression detection with stable fingerprints, attack-path analysis, dependency reachability, architecture smells, health timeline, commit intelligence and the natural-language repository assistant.',
      },
      {
        label: 'Interoperability',
        detail: 'SARIF 2.1.0 export and deduplication/root-cause grouping across analyzers.',
      },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Changelog
        </p>
        <h1 className="type-display mt-2">
          What shipped
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Honest notes on what changed, newest first. Every item is live in the
          product — not a roadmap.
        </p>

        <ol className="mt-12 space-y-10">
          {ENTRIES.map((entry) => (
            <li key={entry.date} className="relative border-l border-border pl-6">
              <span
                className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary"
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-3">
                <time className="text-xs font-medium tabular-nums text-muted-foreground">
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h2 className="mt-1 font-display text-2xl font-semibold">{entry.title}</h2>
              <Card className="mt-4">
                <CardContent className="divide-y divide-border/70 py-0">
                  {entry.items.map((item) => (
                    <div key={item.label} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </main>
    </MarketingShell>
  );
}
