'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, FileText, Search, SearchX } from 'lucide-react';
import { ALL_HELP_ARTICLES, HELP_CATEGORIES, POPULAR_LIST } from '@/components/help/data';

/**
 * Live help search. Filters every real article by title/category/blurb and
 * shows matched categories so the user can drill into a topic even when no
 * single article matches.
 */
export function HelpSearch() {
  const [query, setQuery] = useState('');
  // Support ?q= deep links (also used by the WebSite SearchAction JSON-LD so
  // the sitelinks search box is honest).
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setQuery(q);
  }, [searchParams]);
  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed) return [];
    return ALL_HELP_ARTICLES.filter((a) =>
      [a.title, a.category, a.blurb].some((field) => field.toLowerCase().includes(trimmed))
    );
  }, [trimmed]);

  const matchedCategories = useMemo(() => {
    if (!trimmed) return HELP_CATEGORIES;
    return HELP_CATEGORIES.filter((c) => {
      if (c.label.toLowerCase().includes(trimmed) || c.description.toLowerCase().includes(trimmed)) {
        return true;
      }
      return c.articles.some((a) =>
        [a.title, a.blurb].some((field) => field.toLowerCase().includes(trimmed))
      );
    });
  }, [trimmed]);

  return (
    <div className="w-full max-w-2xl">
      <div className="group relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="How can we help? Try “evidence”, “proof of fix”, “billing”…"
          aria-label="Search help articles"
          className="h-14 w-full rounded-2xl border bg-card pl-12 pr-4 text-base shadow-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        />
      </div>

      {trimmed && (
        <div className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-lg">
          {results.length === 0 ? (
            <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
              <SearchX className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">No articles matched “{query}”.</p>
                <p>Try a different term, or browse a category below.</p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.slice(0, 8).map((article) => (
                <li key={`${article.category}-${article.title}`}>
                  <Link
                    href={article.href}
                    className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-accent/60"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium group-hover:text-primary">{article.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{article.blurb}</p>
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {article.category}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border/60 bg-muted/40 px-5 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Browse by category
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {matchedCategories.slice(0, 6).map((c) => (
                <Link
                  key={c.id}
                  href={c.href}
                  className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <c.icon className="h-3 w-3" /> {c.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** “Most viewed” list used on the hub. */
export function PopularArticles() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Most viewed articles
      </p>
      <ul className="divide-y divide-border/50 rounded-2xl border bg-card shadow-sm">
        {POPULAR_LIST.map((a) => (
          <li key={`${a.title}-${a.href}`}>
            <Link
              href={a.href}
              className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-accent/60"
            >
              <div>
                <p className="text-sm font-medium group-hover:text-primary">{a.title}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{a.blurb}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
