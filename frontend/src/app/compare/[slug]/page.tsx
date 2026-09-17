import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Minus } from 'lucide-react';
import { SITE_URL } from '@/lib/site-url';
import { COMPARISONS, getComparison } from '@/lib/seo/comparisons';

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const c = getComparison(params.slug);
  if (!c) return { title: 'Not found' };
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: `/compare/${c.slug}` },
    openGraph: {
      type: 'article',
      title: c.title,
      description: c.description,
      url: `${SITE_URL}/compare/${c.slug}`,
    },
  };
}

export default function ComparisonPage({ params }: { params: { slug: string } }) {
  const c = getComparison(params.slug);
  if (!c) notFound();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: c.title,
      description: c.description,
      author: { '@type': 'Organization', name: 'RepoVeriX' },
      mainEntityOfPage: `${SITE_URL}/compare/${c.slug}`,
      keywords: [c.vs, 'comparison', 'code auditing', 'SAST'].join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RepoVeriX', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE_URL}/compare` },
        { '@type': 'ListItem', position: 3, name: c.vs, item: `${SITE_URL}/compare/${c.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: `When is ${c.vs} the better choice?`,
          acceptedAnswer: { '@type': 'Answer', text: c.chooseThem.join(' ') },
        },
        {
          '@type': 'Question',
          name: 'When is RepoVeriX the better choice?',
          acceptedAnswer: { '@type': 'Answer', text: c.chooseUs.join(' ') },
        },
        {
          '@type': 'Question',
          name: `Can RepoVeriX and ${c.vs} be used together?`,
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. RepoVeriX exports SARIF 2.1.0, so its validated findings can feed the same dashboards and CI gates other tools use. The comparison is about where validation and verification happen, not about replacing every tool.',
          },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/compare" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← All comparisons
          </Link>
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            RepoVeriX
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span aria-hidden> / </span>
          <Link href="/compare" className="hover:text-foreground">Compare</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">{c.vs}</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{c.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{c.description}</p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What {c.vs} is</h2>
          <p className="mt-2 text-foreground/90">{c.whatTheyAre}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Category-level description of typical behavior — not a claim about any vendor&apos;s
            private implementation.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Capability comparison</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Capability</th>
                  <th className="px-4 py-3 font-semibold">{c.vs}</th>
                  <th className="px-4 py-3 font-semibold">RepoVeriX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {c.rows.map((r) => (
                  <tr key={r.capability} className="align-top">
                    <td className="px-4 py-3 font-medium">{r.capability}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.them}</td>
                    <td className="px-4 py-3">{r.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Minus className="h-4 w-4 text-muted-foreground" aria-hidden />
                Choose {c.vs} when
              </h2>
              <ul className="mt-3 space-y-2">
                {c.chooseThem.map((x, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Choose RepoVeriX when
              </h2>
              <ul className="mt-3 space-y-2">
                {c.chooseUs.map((x, i) => (
                  <li key={i} className="text-sm">{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Verify these claims yourself</h2>
          <ul className="mt-3 space-y-2">
            {c.proof.map((p) => (
              <li key={p.href}>
                <Link href={p.href} className="text-sm font-medium text-primary hover:underline">
                  {p.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-lg border border-border bg-muted/40 p-6">
          <h2 className="text-lg font-semibold">Try it on a real repository</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan the{' '}
            <Link href="/vulnerable-repos/vulnerable-app" className="underline hover:text-foreground">
              vulnerable_app fixture
            </Link>{' '}
            free — every finding it produces carries the evidence chain and validation status
            described above, and you can compare that against whatever tool you use today on the
            same code.
          </p>
          <div className="mt-4">
            <Link
              href="/auth/signup"
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create free account
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
