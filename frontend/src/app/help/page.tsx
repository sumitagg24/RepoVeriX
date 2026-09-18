import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Contact,
  LifeBuoy,
  MessageSquare,
  Users,
  Youtube,
} from 'lucide-react';
import { HelpSearch, PopularArticles } from '@/components/help/help-search';
import { HELP_CATEGORIES } from '@/components/help/data';

export const metadata: Metadata = {
  title: 'Help center',
  description: 'Search RepoVeriX help articles, browse categories, or reach the team.',
};

const resources = [
  {
    icon: LifeBuoy,
    title: 'Contact us',
    body: 'Talk to a human about scans, billing or anything else.',
    href: '/help/contact',
  },
  {
    icon: Users,
    title: 'Community',
    body: 'Ask questions and share workflows with other users.',
    href: '/help/community',
  },
  {
    icon: MessageSquare,
    title: 'Request a feature',
    body: 'Suggest and vote on what RepoVeriX builds next.',
    href: '/help/community#request-a-feature',
  },
  {
    icon: Youtube,
    title: 'Video guides',
    body: 'Short walkthroughs of the core audit loop.',
    href: '/docs/getting-started',
  },
];

export default function HelpPage() {
  return (
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_90%_at_50%_0%,hsl(var(--primary)/0.1),transparent)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
          {/* Hero + search */}
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <BookOpen className="h-3.5 w-3.5" />
              Help Center
            </span>
            <h1 className="type-display mt-5 text-balance">
              How can we help?
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Search every article, or browse by topic. Everything links to the product itself —
              no dead ends.
            </p>
            <div className="mt-8 flex justify-center">
              <Suspense fallback={null}>
                <HelpSearch />
              </Suspense>
            </div>

            {/* Resource quick links */}
            <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 lg:grid-cols-4">
              {resources.map((r) => (
                <Link
                  key={r.title}
                  href={r.href}
                  className="group rounded-2xl border bg-card/70 p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <r.icon className="h-5 w-5 text-primary" />
                  <p className="mt-2 text-sm font-semibold group-hover:text-primary">{r.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{r.body}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Categories */}
          <section className="mt-20">
            <h2 className="font-display text-2xl font-semibold tracking-tight">Categories</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start here — every category maps to real, working pages.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HELP_CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  href={cat.href}
                  className="group flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                      <cat.icon className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">{cat.label}</h3>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground group-hover:text-primary">
                    {cat.articles.length} articles →
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* Most viewed + contact card */}
          <section className="mt-20 grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <PopularArticles />
            </div>
            <div className="lg:col-span-2">
              <div className="rounded-2xl border bg-card p-6 shadow-sm">
                <LifeBuoy className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">Still can’t find what you’re looking for?</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Open a support request with your scan details, or ask the community. We usually
                  reply within a business day.
                </p>
                <div className="mt-5 space-y-2.5">
                  <Link href="/help/contact">
                    <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
                      <Contact className="h-4 w-4" /> Contact support
                    </span>
                  </Link>
                  <Link
                    href="/help/community"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    Join the community
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
  );
}
