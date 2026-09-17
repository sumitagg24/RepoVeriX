import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SITE_URL } from '@/lib/site-url';
import { GLOSSARY_TERMS, getGlossaryTerm } from '@/lib/seo/glossary';

export function generateStaticParams() {
  return GLOSSARY_TERMS.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { term: string };
}): Promise<Metadata> {
  const t = getGlossaryTerm(params.term);
  if (!t) return { title: 'Not found' };
  return {
    title: `What is ${t.term.toLowerCase()}? — definition`,
    description: t.short,
    alternates: { canonical: `/glossary/${t.slug}` },
    openGraph: {
      type: 'article',
      title: `What is ${t.term.toLowerCase()}?`,
      description: t.short,
      url: `${SITE_URL}/glossary/${t.slug}`,
    },
  };
}

export default function GlossaryTermPage({ params }: { params: { term: string } }) {
  const t = getGlossaryTerm(params.term);
  if (!t) notFound();

  const others = GLOSSARY_TERMS.filter((x) => x.slug !== t.slug).slice(0, 4);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTerm',
      name: t.term,
      description: t.short,
      url: `${SITE_URL}/glossary/${t.slug}`,
      inDefinedTermSet: `${SITE_URL}/glossary`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RepoVeriX', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Glossary', item: `${SITE_URL}/glossary` },
        { '@type': 'ListItem', position: 3, name: t.term, item: `${SITE_URL}/glossary/${t.slug}` },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/glossary" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Glossary
          </Link>
          <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            RepoVeriX
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <span aria-hidden> / </span>
          <Link href="/glossary" className="hover:text-foreground">Glossary</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">{t.term}</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          What is {t.term.toLowerCase()}?
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t.short}</p>

        <div className="mt-6">
          <Badge variant="outline">{t.category}</Badge>
        </div>

        <div className="mt-8 space-y-4">
          {t.body.map((p, i) => (
            <p key={i} className="leading-relaxed text-foreground/90">{p}</p>
          ))}
        </div>

        {t.related && t.related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-semibold">See it in the product</h2>
            <ul className="mt-3 space-y-2">
              {t.related.map((r) => (
                <li key={r.href}>
                  <Link href={r.href} className="text-sm font-medium text-primary hover:underline">
                    {r.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <h2 className="text-lg font-semibold">Related terms</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((o) => (
              <Link key={o.slug} href={`/glossary/${o.slug}`}>
                <Badge variant="secondary" className="hover:bg-muted">{o.term}</Badge>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
