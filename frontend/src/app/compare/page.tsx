import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Scale } from 'lucide-react';
import { COMPARISONS } from '@/lib/seo/comparisons';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Honest scanner comparisons',
  description:
    'RepoVeriX vs Semgrep, Snyk and CodeQL: what pattern matchers, advisory databases and query frameworks do well, what they leave to humans, and where validated evidence and verified repair change the workflow.',
  alternates: { canonical: '/compare' },
  openGraph: {
    title: 'Honest scanner comparisons',
    description: 'Category-level comparisons with honest trade-offs, grounded in real pipeline behavior.',
    url: `${SITE_URL}/compare`,
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'RepoVeriX comparisons',
  itemListElement: COMPARISONS.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.title,
    url: `${SITE_URL}/compare/${c.slug}`,
  })),
};

export default function CompareHub() {
  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comparisons</p>
        <h1 className="type-lead mt-2">
          Honest comparisons, no vendor bashing
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          These are category-level comparisons: what pattern matchers, advisory platforms and query
          frameworks genuinely do well, what they leave to human triage, and where validated
          evidence and execution-verified repair change the day-to-day workflow. Every RepoVeriX
          claim links to the page where you can verify it.
        </p>

        <div className="mt-10 grid gap-4">
          {COMPARISONS.map((c) => (
            <Link key={c.slug} href={`/compare/${c.slug}`} className="group">
              <Card className="transition-colors group-hover:border-foreground/30">
                <CardContent className="flex items-start justify-between gap-4 p-6">
                  <div>
                    <h2 className="text-lg font-semibold group-hover:underline">{c.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mt-14 rounded-lg border border-border bg-muted/40 p-6">
          <div className="flex items-start gap-3">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">These tools are complements too</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                RepoVeriX exports SARIF 2.1.0, so its validated findings can land in the same
                dashboards and CI gates other tools feed. The comparisons above are about where the
                validation happens — not a claim that you must rip anything out.
              </p>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
