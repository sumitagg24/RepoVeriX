import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SITE_URL } from '@/lib/site-url';
import { SAMPLE_REPOS, getSampleRepo } from '@/lib/seo/repos';

export function generateStaticParams() {
  return SAMPLE_REPOS.map((r) => ({ name: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { name: string };
}): Promise<Metadata> {
  const r = getSampleRepo(params.name);
  if (!r) return { title: 'Not found' };
  return {
    title: `${r.name} — deliberately vulnerable fixture repository`,
    description: r.summary,
    alternates: { canonical: `/vulnerable-repos/${r.slug}` },
    openGraph: {
      type: 'article',
      title: `${r.name} — deliberately vulnerable fixture repository`,
      description: r.summary,
      url: `${SITE_URL}/vulnerable-repos/${r.slug}`,
    },
  };
}

export default function SampleRepoPage({ params }: { params: { name: string } }) {
  const r = getSampleRepo(params.name);
  if (!r) notFound();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `${r.name}: a deliberately vulnerable fixture repository`,
      description: r.summary,
      author: { '@type': 'Organization', name: 'RepoVeriX' },
      mainEntityOfPage: `${SITE_URL}/vulnerable-repos/${r.slug}`,
      keywords: [r.name, ...r.findingClasses.map((f) => f.name)].join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RepoVeriX', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Sample repositories', item: `${SITE_URL}/vulnerable-repos` },
        { '@type': 'ListItem', position: 3, name: r.name, item: `${SITE_URL}/vulnerable-repos/${r.slug}` },
      ],
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
          <Link href="/vulnerable-repos" className="hover:text-foreground">Sample repositories</Link>
          <span aria-hidden> / </span>
          <span aria-current="page" className="font-mono">{r.name}</span>
        </nav>

        <h1 className="mt-4 font-mono text-3xl font-bold tracking-tight">{r.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{r.stack}</p>
        <p className="mt-4 text-lg text-muted-foreground">{r.summary}</p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          {r.findingClasses.map((f) => (
            <Link key={f.name} href={`/vulnerabilities/${f.vulnSlug}`}>
              <Badge variant="outline" className="hover:bg-muted">{f.name}</Badge>
            </Link>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What&apos;s inside</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {r.files.map((f) => (
                  <tr key={f.path}>
                    <td className="px-4 py-2.5 font-mono text-xs">{f.path}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{f.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Routes an attacker would probe</h2>
          <div className="mt-4 grid gap-3">
            {r.endpoints.map((e) => (
              <Card key={e.route}>
                <CardContent className="p-4">
                  <p className="font-mono text-sm font-semibold">{e.route}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">handler: {e.handler}</p>
                  <p className="mt-2 text-sm">{e.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Seeded defect classes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each class links to the full detection page — how the engine finds it, the evidence
            chain, and the counterexample checks that keep it honest.
          </p>
          <div className="mt-4 grid gap-3">
            {r.findingClasses.map((f) => (
              <Card key={f.name}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      <Link href={`/vulnerabilities/${f.vulnSlug}`} className="hover:underline">
                        {f.name}
                      </Link>
                    </h3>
                    <span className="font-mono text-xs text-muted-foreground">{f.where}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{f.detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {r.fixedCounterpart && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">The fixed counterpart</h2>
            <p className="mt-2 text-sm text-muted-foreground">{r.fixedCounterpart}</p>
          </section>
        )}

        <section className="mt-12 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-semibold">Scan it now</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {r.hasTests
              ? 'This fixture ships with a test suite, so the proof-of-fix pipeline can run the full loop: generate a patch, apply it to an isolated copy, run the tests, and certify the repair.'
              : 'This fixture has no test suite, so patches can still be verified by static checks and detector re-analysis — the pipeline reports which checks ran and which could not.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/auth/signup" className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Create free account
            </Link>
            <Link href="/docs" className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium hover:bg-muted">
              Read the docs
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
