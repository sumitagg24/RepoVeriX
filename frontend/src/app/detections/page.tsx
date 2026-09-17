import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { DETECTION_RULES } from '@/lib/seo/rules';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Detection rules reference — every RVX rule, exactly what it matches',
  description:
    'Complete reference for RepoVeriX detection rules: what each RVX rule matches in the AST, its severity and confidence model, the context signals it records, known false-positive patterns, and the fix it expects.',
  alternates: { canonical: '/detections' },
  openGraph: {
    title: 'Detection rules reference — every RVX rule, exactly what it matches',
    description:
      'Complete reference for RepoVeriX detection rules with deterministic matching logic and evidence models.',
    url: `${SITE_URL}/detections`,
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'RepoVeriX detection rules reference',
  description:
    'Reference documentation for every deterministic detection rule the RepoVeriX engine emits.',
  url: `${SITE_URL}/detections`,
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: DETECTION_RULES.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `${r.id} — ${r.name}`,
      url: `${SITE_URL}/detections/${r.slug}`,
    })),
  },
};

export default function DetectionsHub() {
  const python = DETECTION_RULES.filter((r) => r.language === 'python');
  const js = DETECTION_RULES.filter((r) => r.language === 'javascript');

  const group = (title: string, rules: typeof DETECTION_RULES) => (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {rules.map((r) => (
          <Link key={r.id} href={`/detections/${r.slug}`} className="group">
            <Card className="transition-colors group-hover:border-foreground/30">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="font-mono text-sm font-semibold group-hover:underline">{r.id}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{r.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{r.category}</Badge>
                    <Badge variant="outline">{r.vulnSlug}</Badge>
                  </div>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← RepoVeriX
          </Link>
          <Link href="/vulnerabilities" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Vulnerability classes →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Detection rules
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Every rule, exactly what it matches
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          These are the {DETECTION_RULES.length} deterministic rules the RepoVeriX engine emits today.
          Each page documents the matcher in the detector&apos;s own terms — no marketing gloss —
          plus the context signals recorded with each finding, the false-positive patterns the
          counterexample validator screens for, and the fix the engine expects.
        </p>

        {group('Python', python)}
        {group('JavaScript / Node.js', js)}

        <section className="mt-14 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-semibold">Rule IDs are stable identifiers</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rule IDs appear in findings, SARIF exports, API responses and evidence records. They are
            stable across releases: a rule ID identifies the same matcher everywhere it appears, so
            dashboards and CI gates built on them do not break when code moves.
          </p>
        </section>
      </main>
    </div>
  );
}
