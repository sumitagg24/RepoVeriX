'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { SeverityBadge } from '@/components/system/severity-badge';
import { ConsoleEmpty } from '@/components/rvx/primitives';
import { RvxLedger } from '@/components/rvx/surface';
import { Button } from '@/components/ui/button';
import { DETECTION_RULES } from '@/lib/seo/rules';
import { asSeverity } from '@/lib/evidence';

const CATEGORIES = ['all', ...Array.from(new Set(DETECTION_RULES.map((rule) => rule.category)))];
const LANGUAGES = ['all', ...Array.from(new Set(DETECTION_RULES.map((rule) => rule.language)))];

function ruleSeverity(value: string) {
  const first = value.split(/\s+/)[0]?.toLowerCase();
  return asSeverity(first);
}

export default function RulesPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [language, setLanguage] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DETECTION_RULES.filter((rule) => {
      if (category !== 'all' && rule.category !== category) return false;
      if (language !== 'all' && rule.language !== language) return false;
      if (!q) return true;
      return (
        rule.id.toLowerCase().includes(q) ||
        rule.name.toLowerCase().includes(q) ||
        rule.summary.toLowerCase().includes(q) ||
        rule.fix.toLowerCase().includes(q)
      );
    });
  }, [query, category, language]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rvx-eyebrow">Detection catalog</p>
          <h1 className="rvx-title mt-2 text-2xl sm:text-3xl">Rules</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            The same rule IDs the engine emits in findings and SARIF. This catalog is the frontend
            reference for what each detector matches — not a second set of live server rules.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/detections">Public reference</Link>
        </Button>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rule ID, name or guidance"
            aria-label="Search detection rules"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${
                category === item
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {item}
            </button>
          ))}
          {LANGUAGES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLanguage(item)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${
                language === item
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <ConsoleEmpty
          title="No rules match those filters"
          body="Clear the search or choose another category to see the shipped detector catalog."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery('');
                setCategory('all');
                setLanguage('all');
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <RvxLedger
          header={
            <div className="hidden grid-cols-[7.5rem_minmax(0,1.4fr)_5.5rem_5rem_minmax(0,1fr)] gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>ID</span>
              <span>Rule</span>
              <span>Severity</span>
              <span>Language</span>
              <span>Guidance</span>
            </div>
          }
        >
          {filtered.map((rule) => (
            <Link
              key={rule.id}
              href={`/detections/${rule.slug}`}
              className="grid gap-2 px-3 py-3 transition-colors hover:bg-accent/30 md:grid-cols-[7.5rem_minmax(0,1.4fr)_5.5rem_5rem_minmax(0,1fr)] md:items-center"
            >
              <span className="rvx-mono text-[11px] text-foreground">{rule.id}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{rule.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{rule.summary}</span>
              </span>
              <SeverityBadge severity={ruleSeverity(rule.severity)} />
              <span className="rvx-mono text-[11px] capitalize text-muted-foreground">{rule.language}</span>
              <span className="hidden truncate text-xs text-muted-foreground md:block">{rule.fix}</span>
            </Link>
          ))}
        </RvxLedger>
      )}
    </div>
  );
}
