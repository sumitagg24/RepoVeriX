'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GitBranch,
  GitCompare,
  Network,
  ShieldCheck,
  Globe,
  FlaskConical,
  FileJson,
  Webhook,
  KeyRound,
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  Search,
  Wrench,
  History,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { EvidenceLoopStrip } from '@/components/system/evidence-chain';
import { cn } from '@/lib/utils';
import { toneCallout, toneInk } from '@/lib/tone';

/**
 * RVX Tools catalog — every entry maps to a REAL backend router + a REAL
 * frontend route. Nothing listed here is aspirational: status is Available
 * (UI + API shipped) or Beta (API shipped, UI partial). Planned work lives
 * in the docs roadmap, not in this catalog.
 */

type ToolStatus = 'Available' | 'Beta';

type Tool = {
  name: string;
  description: string;
  category: 'Repository' | 'Website' | 'Verification' | 'Export & integration';
  status: ToolStatus;
  inputs: string;
  output: string;
  href: string;
  cta: string;
  docs?: string;
  icon: typeof GitBranch;
};

const TOOLS: Tool[] = [
  {
    name: 'Repository Audit',
    description: 'Full-pipeline scan of a repository snapshot: static detectors, LLM reasoning, evidence validation, findings with confidence.',
    category: 'Repository',
    status: 'Available',
    inputs: 'GitHub / GitLab / any git URL · archive URL · ZIP upload',
    output: 'Scan · findings · evidence chains · report',
    href: '/scans/new',
    cta: 'Start a scan',
    docs: '/docs/getting-started',
    icon: GitBranch,
  },
  {
    name: 'Change Audit',
    description: 'Risk score, blast radius, missing co-changes and test directives for any branch or pasted diff — before it merges.',
    category: 'Repository',
    status: 'Available',
    inputs: 'Branch · diff · pull request',
    output: 'Risk score · blast radius · directives',
    href: '/pull-requests',
    cta: 'Audit a change',
    docs: '/docs/features',
    icon: GitCompare,
  },
  {
    name: 'Evidence Graph',
    description: 'Queryable source → transformation → sink chains per scan, with counterexample checks that can disprove a claim.',
    category: 'Repository',
    status: 'Available',
    inputs: 'Completed scan',
    output: 'Evidence graph · attack paths',
    href: '/repositories',
    cta: 'Open a repository',
    docs: '/docs/concepts',
    icon: Network,
  },
  {
    name: 'Code Health',
    description: 'Deterministic 1–10 file scores across defect risk, maintainability and performance, with ranked refactor plans.',
    category: 'Repository',
    status: 'Available',
    inputs: 'Imported repository',
    output: 'Health scores · refactor plan',
    href: '/repositories',
    cta: 'Check health',
    docs: '/docs/features',
    icon: Activity,
  },
  {
    name: 'Regression Check',
    description: 'Re-run detectors across scan history to confirm a fixed finding stays fixed.',
    category: 'Repository',
    status: 'Available',
    inputs: 'Repository · scan history',
    output: 'Regression verdict',
    href: '/repositories',
    cta: 'Compare scans',
    docs: '/docs/features',
    icon: History,
  },
  {
    name: 'Ask RepoVeriX',
    description: 'Repository-grounded Q&A over symbols, imports and call relationships — answers cite code, not vibes.',
    category: 'Repository',
    status: 'Beta',
    inputs: 'Imported repository',
    output: 'Grounded answer · citations',
    href: '/repositories',
    cta: 'Ask a question',
    docs: '/docs/features',
    icon: MessageSquare,
  },
  {
    name: 'Website Audit',
    description: 'Passive, robots-respecting crawl with measured SEO, security-header, accessibility, performance and AI-search-readiness signals.',
    category: 'Website',
    status: 'Available',
    inputs: 'URL · scan mode',
    output: 'Dimension scores · page findings',
    href: '/websites',
    cta: 'Audit a website',
    docs: '/docs/features',
    icon: Globe,
  },
  {
    name: 'Proof of Fix',
    description: 'Candidate patch → sandbox run (tests, static checks, re-analysis) → honest verdict: Verified fix, Partially verified, Rejected, Unverifiable.',
    category: 'Verification',
    status: 'Available',
    inputs: 'Finding · candidate patch',
    output: 'Verification verdict · proof record',
    href: '/findings',
    cta: 'Verify a fix',
    docs: '/docs/concepts',
    icon: ShieldCheck,
  },
  {
    name: 'Test Generation',
    description: 'Reproduction tests generated per finding and executed in the sandbox to confirm the defect before repair.',
    category: 'Verification',
    status: 'Beta',
    inputs: 'Finding',
    output: 'Reproduction test · run result',
    href: '/findings',
    cta: 'Open findings',
    docs: '/docs/concepts',
    icon: FlaskConical,
  },
  {
    name: 'SARIF Export',
    description: 'Findings as SARIF 2.1.0 for GitHub Code Scanning, VS Code and any SARIF consumer.',
    category: 'Export & integration',
    status: 'Available',
    inputs: 'Completed scan',
    output: '.sarif file',
    href: '/docs/api',
    cta: 'Read the API docs',
    docs: '/docs/api',
    icon: FileJson,
  },
  {
    name: 'Reports & Sharing',
    description: 'JSON and Markdown audit reports per scan, plus shareable report links for reviewers and supervisors.',
    category: 'Export & integration',
    status: 'Available',
    inputs: 'Completed scan',
    output: 'JSON / Markdown · share link',
    href: '/scans',
    cta: 'Open scans',
    docs: '/docs/features',
    icon: BookOpen,
  },
  {
    name: 'GitHub & GitLab',
    description: 'OAuth import from GitHub and GitLab, plus URL import from any git host. Tokens encrypted at rest.',
    category: 'Export & integration',
    status: 'Available',
    inputs: 'OAuth connection · repo URL',
    output: 'Imported repository',
    href: '/settings',
    cta: 'Connect a provider',
    docs: '/docs/configuration',
    icon: GitBranch,
  },
  {
    name: 'API Tokens',
    description: 'Personal tokens for the documented REST API — drive scans, findings and exports from CI.',
    category: 'Export & integration',
    status: 'Available',
    inputs: 'Account',
    output: 'API token · docs',
    href: '/settings',
    cta: 'Manage tokens',
    docs: '/docs/api',
    icon: KeyRound,
  },
  {
    name: 'Webhooks',
    description: 'Scan lifecycle events delivered to your endpoints for CI gates and notifications.',
    category: 'Export & integration',
    status: 'Beta',
    inputs: 'Endpoint URL · event types',
    output: 'Signed deliveries',
    href: '/docs/api',
    cta: 'Read the API docs',
    docs: '/docs/api',
    icon: Webhook,
  },
];

const CATEGORIES = ['All', 'Repository', 'Website', 'Verification', 'Export & integration'] as const;

export function ToolsCatalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (!q) return true;
      return `${t.name} ${t.description} ${t.inputs} ${t.output}`.toLowerCase().includes(q);
    });
  }, [query, category]);

  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(55%_80%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6 lg:pt-20">
          <div className="max-w-2xl">
            <p className="mono-label">Tool catalog</p>
            <h1 className="type-display mt-2 text-balance">
              Every capability. <span className="italic text-primary">Nothing invented.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Each tool below maps to a shipped API and a working route. Statuses are honest:
              Available means UI + API today; Beta means the API is live and the UI is catching up.
            </p>
            <div className="mt-6">
              <EvidenceLoopStrip />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-sm sm:flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools — try “sarif” or “website”…"
                className="pl-9"
                aria-label="Search tools"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by category">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    category === c
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {results.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed px-4 py-16 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground/70">
              <Wrench className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="font-medium">No tools match “{query}”</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Try a different term — or browse the full catalog by clearing the search.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setQuery(''); setCategory('All'); }}>
              Clear search
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((tool) => (
              <article
                key={tool.name}
                className="group flex h-full flex-col rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <tool.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      tool.status === 'Available'
                        ? cn(toneCallout('verified'), toneInk('verified'))
                        : cn(toneCallout('probable'), toneInk('probable'))
                    )}
                  >
                    {tool.status}
                  </span>
                </div>
                <p className="mono-label mt-4">{tool.category}</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight">{tool.name}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
                <dl className="mt-4 space-y-1 border-t border-border/60 pt-3 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 font-semibold uppercase tracking-wider text-muted-foreground/70">Inputs</dt>
                    <dd className="text-muted-foreground">{tool.inputs}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 font-semibold uppercase tracking-wider text-muted-foreground/70">Output</dt>
                    <dd className="text-muted-foreground">{tool.output}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2">
                  <Link href={tool.href} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5">
                      {tool.cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </Link>
                  {tool.docs && (
                    <Link
                      href={tool.docs}
                      aria-label={`${tool.name} documentation`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl border bg-card p-8 shadow-sm sm:flex-row">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Not sure where to start?</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Import a repository or enter a website URL — the first scan walks the whole loop:
              analyze → evidence → repair → verify.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/auth/signup">
              <Button className="gap-2">Start free <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
            </Link>
            <Link href="/docs/getting-started">
              <Button variant="outline">Getting started</Button>
            </Link>
          </div>
        </div>
      </section>

    </MarketingShell>
  );
}
