import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SITE_URL } from '@/lib/site-url';
import { VULNERABILITY_CLASSES, getVulnerability } from '@/lib/seo/vulnerabilities';
import { DETECTION_RULES } from '@/lib/seo/rules';

export function generateStaticParams() {
  return VULNERABILITY_CLASSES.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const v = getVulnerability(params.slug);
  if (!v) return { title: 'Not found' };
  return {
    title: v.title,
    description: v.description,
    alternates: { canonical: `/vulnerabilities/${v.slug}` },
    openGraph: {
      type: 'article',
      title: v.title,
      description: v.description,
      url: `${SITE_URL}/vulnerabilities/${v.slug}`,
    },
  };
}

export default function VulnerabilityPage({ params }: { params: { slug: string } }) {
  const v = getVulnerability(params.slug);
  if (!v) notFound();

  const relatedRules = DETECTION_RULES.filter((r) => r.vulnSlug === v.slug);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: v.title,
      description: v.description,
      author: { '@type': 'Organization', name: 'RepoVeriX' },
      mainEntityOfPage: `${SITE_URL}/vulnerabilities/${v.slug}`,
      about: { '@type': 'Thing', name: `${v.name} (${v.cwe})` },
      keywords: [v.name, v.cwe, v.owasp, ...v.languages].join(', '),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'RepoVeriX', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Vulnerability classes', item: `${SITE_URL}/vulnerabilities` },
        { '@type': 'ListItem', position: 3, name: v.name, item: `${SITE_URL}/vulnerabilities/${v.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: `How to fix ${v.name}`,
      description: `Steps to fix ${v.name} (${v.cwe}) and have the fix verified by execution.`,
      step: v.fixSteps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: `Step ${i + 1}`,
        text: s,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: v.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/vulnerabilities" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            ← Vulnerability classes
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
          <Link href="/vulnerabilities" className="hover:text-foreground">Vulnerability classes</Link>
          <span aria-hidden> / </span>
          <span aria-current="page">{v.name}</span>
        </nav>

        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{v.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{v.description}</p>

        <div className="mt-6 flex flex-wrap gap-1.5">
          <Badge>{v.cwe}</Badge>
          <Badge variant="outline">{v.owasp}</Badge>
          {v.languages.map((l) => (
            <Badge key={l} variant="secondary">{l}</Badge>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">How RepoVeriX detects it — deterministically</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Detection is performed by the static analyzer, not the LLM. The model may reason about a
            candidate afterwards, but the claim below is what the detector checks in the AST.
          </p>
          <ol className="mt-4 space-y-3">
            {v.detection.map((d, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">The evidence chain a finding carries</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A finding is only as good as its proof. RepoVeriX records the full chain so a reviewer —
            or a counterexample check — can audit it.
          </p>
          <ul className="mt-4 space-y-2">
            {v.evidenceKinds.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" aria-hidden />
                {e}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">When the claim is refuted: counterexample checks</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The LLM proposes; the validator checks. If any of these conditions hold, a candidate
            finding is downgraded or rejected — with the refuting evidence recorded.
          </p>
          <ul className="mt-4 space-y-2">
            {v.counterexamples.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span aria-hidden className="text-muted-foreground">✗</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Vulnerable vs fixed — from the real fixture</h2>
          <div className="mt-4 grid gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Vulnerable</p>
                <p className="mt-1 text-sm text-muted-foreground">{v.vulnerableSample.caption}</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                  <code>{v.vulnerableSample.code}</code>
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">Source: {v.vulnerableSample.source}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Fixed</p>
                <p className="mt-1 text-sm text-muted-foreground">{v.fixedSample.caption}</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
                  <code>{v.fixedSample.code}</code>
                </pre>
                <p className="mt-2 text-xs text-muted-foreground">Source: {v.fixedSample.source}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">How to fix it — verified by execution</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A fix is only called VERIFIED after the reproduction test fails on the vulnerable code
            and passes on the patched copy, the test suite passes, static checks are clean, and the
            same detectors re-run and report the finding gone.
          </p>
          <ol className="mt-4 space-y-3">
            {v.fixSteps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </section>

        {relatedRules.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Detection rules for this class</h2>
            <div className="mt-4 grid gap-3">
              {relatedRules.map((r) => (
                <Link key={r.id} href={`/detections/${r.slug}`} className="group">
                  <Card className="transition-colors group-hover:border-foreground/30">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-mono text-sm font-semibold">{r.id}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{r.summary}</p>
                      </div>
                      <Badge variant="outline">{r.language}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Frequently asked questions</h2>
          <div className="mt-4 divide-y divide-border">
            {v.faqs.map((f) => (
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
          <h2 className="text-lg font-semibold">See this detection run for real</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a free account and scan the <Link href="/vulnerable-repos/vulnerable-app" className="underline hover:text-foreground">vulnerable_app fixture</Link> —
            it contains this exact class with full evidence chains, and the fix pipeline can verify the repair by execution.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/auth/signup" className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Run a real scan free
            </Link>
            <Link href="/docs" className="inline-flex h-10 items-center rounded-md border border-border px-5 text-sm font-medium hover:bg-muted">
              Read the docs
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
