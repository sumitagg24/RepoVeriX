'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/states';
import {
  FilterChips,
  ResultCount,
  SearchInput,
  SelectFilter,
  Toolbar,
} from '@/components/ui/toolbar';
import { DETECTION_RULES, RULE_CATEGORIES, RULE_LANGUAGES } from '@/lib/rules';
import { CATEGORY_LABEL, CONFIDENCE_LABEL } from '@/lib/domain';

/**
 * Rule catalogue.
 *
 * These are the rule IDs the engine emits, read from the same catalogue the
 * engine documents, so the list is a reference rather than a marketing page. The
 * filters are local because the catalogue ships with the frontend and does not
 * change between requests.
 */
export default function RulesPage() {
  const [search, setSearch] = React.useState('');
  const [severity, setSeverity] = React.useState('all');
  const [language, setLanguage] = React.useState('all');
  const [category, setCategory] = React.useState('all');

  const rows = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return DETECTION_RULES.filter((rule) => {
      if (severity !== 'all' && rule.severity !== severity) return false;
      if (language !== 'all' && rule.language !== language) return false;
      if (category !== 'all' && rule.category !== category) return false;
      if (!term) return true;
      return (
        rule.id.toLowerCase().includes(term) ||
        rule.name.toLowerCase().includes(term) ||
        rule.summary.toLowerCase().includes(term)
      );
    });
  }, [search, severity, language, category]);

  return (
    <AppPage>
      <PageHeader
        title="Rules"
        description="What each detector looks for, the context it attaches to the evidence chain, and where it is known to be noisy."
      />

      {DETECTION_RULES.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-4" aria-hidden="true" />}
          title="No rules in this build"
          body="The rule catalogue is empty, which means the frontend was built without the detector catalogue."
        />
      ) : (
        <>
          <Toolbar>
            <SearchInput
              label="Search rules"
              value={search}
              onChange={setSearch}
              placeholder="Search rule id, name or summary"
            />
            <FilterChips
              label="Severity"
              value={severity}
              onChange={setSeverity}
              options={[
                { value: 'all', label: 'All' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <SelectFilter
              label="Language"
              value={language}
              onChange={setLanguage}
              anyLabel="All languages"
              options={RULE_LANGUAGES.map((value) => ({
                value,
                label: value === 'python' ? 'Python' : 'JavaScript',
              }))}
            />
            <SelectFilter
              label="Category"
              value={category}
              onChange={setCategory}
              anyLabel="All categories"
              options={RULE_CATEGORIES.map((value) => ({
                value,
                label: CATEGORY_LABEL[value as keyof typeof CATEGORY_LABEL] ?? value,
              }))}
            />
          </Toolbar>

          <ResultCount shown={rows.length} total={DETECTION_RULES.length} label="rules" />

          {rows.length === 0 ? (
            <EmptyState
              title="No rule matches those filters"
              body="Clear the filters to see the whole catalogue."
              action={
                <button
                  type="button"
                  className="text-[13px] font-medium text-accent"
                  onClick={() => {
                    setSearch('');
                    setSeverity('all');
                    setLanguage('all');
                    setCategory('all');
                  }}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {rows.map((rule) => (
                <li key={rule.id}>
                  <Panel interactive className="h-full">
                    <Link
                      href={`/rules/${rule.slug}`}
                      className="flex h-full flex-col gap-3 px-5 py-5 focus-visible:outline-none"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <SeverityBadge severity={rule.severity} compact />
                        <span className="font-mono text-[11.5px] text-muted">{rule.id}</span>
                        <span className="chip">
                          {rule.language === 'python' ? 'Python' : 'JavaScript'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-[15px] font-semibold leading-snug text-ink">
                          {rule.name}
                        </h2>
                        <ChevronRight className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
                      </div>
                      <p className="text-[13.5px] leading-relaxed text-body">{rule.summary}</p>
                      <p className="mt-auto pt-2 font-mono text-[11.5px] text-faint">
                        {CONFIDENCE_LABEL(rule.confidence)} at detection
                      </p>
                    </Link>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppPage>
  );
}
