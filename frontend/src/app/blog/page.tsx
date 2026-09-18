import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, CalendarDays, Clock } from 'lucide-react';
import { BLOG_POSTS } from '@/lib/blog';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'How RepoVeriX verifies automated repairs, why findings carry evidence chains, and what the benchmark harness measures.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'Blog - RepoVeriX',
    description:
      'Engineering notes on evidence-grounded auditing and verified automated repair.',
    url: `${SITE_URL}/blog`,
  },
};

export default function BlogIndex() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Engineering blog
        </p>
        <h1 className="type-display mt-2 text-balance">
          How RepoVeriX thinks about evidence
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Notes from building an auditor that has to prove itself: verification
          pipelines, counterexample validation, and honest measurement.
        </p>

        <ul className="mt-10 space-y-4">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block">
                <Card className="transition-colors group-hover:border-primary/40">
                  <CardContent className="py-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {new Date(post.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {post.readMinutes} min read
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-2xl font-semibold group-hover:text-primary">
                      {post.title}
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {post.description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {post.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Read post
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingShell>
  );
}
