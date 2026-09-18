import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { GLOSSARY_TERMS } from '@/lib/seo/glossary';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Glossary — evidence chains, sinks, SARIF, reachability, proof of fix',
  description:
    'Plain, accurate definitions of the terms that decide whether code-audit findings can be trusted: evidence chains, sources, sinks, counterexample validation, blast radius, SARIF, reachability, hotspots, false-positive rate, proof of fix, SBOM.',
  alternates: { canonical: '/glossary' },
  openGraph: {
    title: 'Code-audit glossary — the terms that decide trust',
    description:
      'Evidence chains, sinks, counterexample validation, SARIF, reachability and proof of fix — defined accurately.',
    url: `${SITE_URL}/glossary`,
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  name: 'RepoVeriX code-audit glossary',
  description: 'Definitions of code-auditing, security-analysis and verification terminology.',
  url: `${SITE_URL}/glossary`,
  hasDefinedTerm: GLOSSARY_TERMS.map((t) => ({
    '@type': 'DefinedTerm',
    name: t.term,
    description: t.short,
    url: `${SITE_URL}/glossary/${t.slug}`,
  })),
};

const categories: { id: string; label: string }[] = [
  { id: 'security', label: 'Security analysis' },
  { id: 'analysis', label: 'Repository analysis' },
  { id: 'process', label: 'Validation & trust' },
  { id: 'standards', label: 'Standards & formats' },
];

export default function GlossaryPage() {
  return (
    <MarketingShell>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Glossary</p>
        <h1 className="type-lead mt-2">
          The vocabulary of trustworthy code auditing
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Short, accurate definitions of the terms that decide whether a finding can be believed —
          no filler, no marketing gloss. Where a concept maps to something concrete in the product,
          the entry links to it.
        </p>

        {categories.map((cat) => {
          const terms = GLOSSARY_TERMS.filter((t) => t.category === cat.id);
          if (terms.length === 0) return null;
          return (
            <section key={cat.id} className="mt-10">
              <h2 className="text-lg font-semibold">{cat.label}</h2>
              <div className="mt-4 grid gap-3">
                {terms.map((t) => (
                  <Link key={t.slug} href={`/glossary/${t.slug}`} className="group">
                    <Card className="transition-colors group-hover:border-foreground/30">
                      <CardContent className="flex items-start justify-between gap-4 p-5">
                        <div>
                          <p className="font-semibold group-hover:underline">{t.term}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{t.short}</p>
                        </div>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </MarketingShell>
  );
}
