import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { VULNERABILITY_CLASSES } from '@/lib/seo/vulnerabilities';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Vulnerability classes with proof, not guesses',
  description:
    'SQL injection, command injection, dynamic code execution, hardcoded secrets, weak cryptography and broad exception handling — how each is detected deterministically, what evidence proves a real finding, and how the fix is verified.',
  alternates: { canonical: '/vulnerabilities' },
  openGraph: {
    title: 'Vulnerability classes with proof, not guesses',
    description:
      'Six vulnerability classes with deterministic detection logic, evidence chains and verified fixes.',
    url: `${SITE_URL}/vulnerabilities`,
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Vulnerability classes RepoVeriX detects',
  description:
    'Index of vulnerability classes RepoVeriX detects deterministically, each with detection logic, evidence chains, counterexample checks and verified fixes.',
  url: `${SITE_URL}/vulnerabilities`,
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: VULNERABILITY_CLASSES.map((v, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: v.name,
      url: `${SITE_URL}/vulnerabilities/${v.slug}`,
    })),
  },
};

export default function VulnerabilitiesHub() {
  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vulnerability classes
        </p>
        <h1 className="type-lead mt-2">
          What RepoVeriX detects — and how it proves it
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Each class below is detected by a deterministic analyzer in the RepoVeriX engine —
          no LLM guesswork in the detection step. Every page documents the detection logic,
          the evidence chain a finding carries, the counterexample checks that can refute it,
          and the fix pattern RepoVeriX verifies by execution.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {VULNERABILITY_CLASSES.map((v) => (
            <Link key={v.slug} href={`/vulnerabilities/${v.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/30">
                <CardContent className="flex h-full flex-col p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold group-hover:underline">{v.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {v.cwe} · {v.owasp}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{v.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{v.severity.split('(')[0].split('/')[0].trim()}</Badge>
                    {v.languages.map((l) => (
                      <Badge key={l} variant="secondary">{l}</Badge>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Detected by {v.rules.length} rule{v.rules.length > 1 ? 's' : ''} · {v.rules.join(', ')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mt-14 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-semibold">See them detected on a real repository</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The <Link href="/vulnerable-repos/vulnerable-app" className="underline hover:text-foreground">vulnerable_app</Link> and{' '}
            <Link href="/vulnerable-repos/vulnerable-js" className="underline hover:text-foreground">vulnerable_js</Link> fixture
            repositories ship with RepoVeriX and contain every class above. Scan them free to see the
            evidence chains these pages describe.
          </p>
        </section>
      </main>
    </MarketingShell>
  );
}
