import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { SAMPLE_REPOS } from '@/lib/seo/repos';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Sample vulnerable repositories — scan them free, see the evidence',
  description:
    'Deliberately vulnerable fixture repositories shipped with RepoVeriX: every seeded defect is real, every finding carries an evidence chain, and the fix pipeline can verify the repair by execution. Scan them free.',
  alternates: { canonical: '/vulnerable-repos' },
  openGraph: {
    title: 'Sample vulnerable repositories — scan them free, see the evidence',
    description:
      'Fixture repositories with seeded, documented defects — scan free and inspect the evidence chains.',
    url: `${SITE_URL}/vulnerable-repos`,
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Sample vulnerable repositories',
  description:
    'Deliberately vulnerable fixture repositories shipped with RepoVeriX for demos, tests and benchmarks.',
  url: `${SITE_URL}/vulnerable-repos`,
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: SAMPLE_REPOS.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: r.name,
      url: `${SITE_URL}/vulnerable-repos/${r.slug}`,
    })),
  },
};

export default function VulnerableReposHub() {
  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sample repositories
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Sample repositories, real findings
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          These fixtures ship inside RepoVeriX&apos;s own test suite. Every defect was seeded on
          purpose and is documented in the repository README — so when you scan one, you can check
          the engine&apos;s findings against ground truth instead of trusting a vendor&apos;s
          &ldquo;trust us&rdquo; demo. All credentials in them are fake placeholders.
        </p>

        <div className="mt-10 grid gap-4">
          {SAMPLE_REPOS.map((r) => (
            <Link key={r.slug} href={`/vulnerable-repos/${r.slug}`} className="group">
              <Card className="transition-colors group-hover:border-foreground/30">
                <CardContent className="flex items-start justify-between gap-4 p-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="font-mono text-lg font-semibold group-hover:underline">{r.name}</h2>
                      {r.hasTests ? (
                        <Badge variant="secondary">has test suite</Badge>
                      ) : (
                        <Badge variant="outline">no tests</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.stack}</p>
                    <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{r.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.findingClasses.map((f) => (
                        <Badge key={f.name} variant="outline">{f.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mt-14 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-semibold">Why fixtures instead of a cherry-picked demo</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Most security-scanner demos show a curated repository where every detection is a hit.
            These fixtures are different: they are the same repositories RepoVeriX&apos;s unit
            tests and benchmark harness run against, they include a{' '}
            <Link href="/vulnerable-repos/vulnerable-app" className="underline hover:text-foreground">fixed counterpart</Link>{' '}
            the repair verifier must reproduce, and nothing on these pages claims a detection the
            engine cannot show you live.
          </p>
        </section>
      </main>
    </MarketingShell>
  );
}
