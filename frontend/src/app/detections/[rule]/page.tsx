import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SITE_URL } from '@/lib/site-url';
import { DETECTION_RULES, getRule } from '@/lib/seo/rules';

export function generateStaticParams() {
  return DETECTION_RULES.map((r) => ({ rule: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { rule: string };
}): Promise<Metadata> {
  const r = getRule(params.rule);
  if (!r) return { title: 'Not found' };
  return {
    // The root layout's title template appends the brand; naming it here too
    // produced "… — RepoVeriX rule reference - RepoVeriX" in the tab and SERP.
    title: `${r.id}: ${r.name} — rule reference`,
    description: r.summary,
    alternates: { canonical: `/detections/${r.slug}` },
    openGraph: {
      type: 'article',
      title: `${r.id}: ${r.name}`,
      description: r.summary,
      url: `${SITE_URL}/detections/${r.slug}`,
    },
  };
}

export default function RulePage({ params }: { params: { rule: string } }) {
  const r = getRule(params.rule);
  if (!r) notFound();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: `${r.id}: ${r.name}`,
      description: r.summary,
      author: { '@type': 'Organization', name: 'RepoVeriX' },
      mainEntityOfPage: `${SITE_URL}/detections/${r.slug}`,
      about: { '@type': 'SoftwareApplication', name: 'RepoVeriX', applicationCategory: 'DeveloperApplication' },
      keywords: [r.id, r.name, r.language, r.category].join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RepoVeriX', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Detection rules', item: `${SITE_URL}/detections` },
        { '@type': 'ListItem', position: 3, name: r.id, item: `${SITE_URL}/detections/${r.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: r.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span aria-hidden> / </span>
          <Link href="/detections" className="hover:text-foreground">Detection rules</Link>
          <span aria-hidden> / </span>
          <span aria-current="page" className="font-mono">{r.id}</span>
        </nav>

        <h1 className="mt-4 font-mono text-2xl font-bold tracking-tight sm:text-3xl">{r.id}</h1>
        <p className="mt-1 text-xl font-semibold">{r.name}</p>
        <p className="mt-4 text-lg text-muted-foreground">{r.summary}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Language</p>
              <p className="mt-1 text-sm font-medium">{r.language === 'python' ? 'Python' : 'JavaScript / TypeScript'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Severity</p>
              <p className="mt-1 text-sm font-medium">{r.severity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confidence</p>
              <p className="mt-1 text-sm font-medium">{r.confidence}</p>
            </CardContent>
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">How the matcher works</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The rule is deterministic AST analysis — the same input always produces the same finding.
            The LLM never invents this rule; it may only reason about candidates the matcher raised.
          </p>
          <ol className="mt-4 space-y-3">
            {r.howItWorks.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Context signals recorded with the finding</h2>
          <ul className="mt-4 space-y-2">
            {r.contextSignals.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">False-positive handling</h2>
          <p className="mt-2 text-sm text-muted-foreground">{r.falsePositives}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Expected fix</h2>
          <p className="mt-2 text-sm text-muted-foreground">{r.fix}</p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-border">
            {r.faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
                  <span className="mr-2 inline-block transition-transform group-open:rotate-45" aria-hidden>+</span>
                  {f.q}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-semibold">See {r.id} fire on a real repository</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The vulnerability class page for{' '}
            <Link href={`/vulnerabilities/${r.vulnSlug}`} className="underline hover:text-foreground">
              {r.vulnSlug.replace(/-/g, ' ')}
            </Link>{' '}
            shows the before/after code from the fixture repository, and the{' '}
            <Link href="/vulnerable-repos" className="underline hover:text-foreground">
              sample repositories
            </Link>{' '}
            can be scanned free to watch this rule produce a full evidence chain.
          </p>
        </section>
      </main>
    </MarketingShell>
  );
}
