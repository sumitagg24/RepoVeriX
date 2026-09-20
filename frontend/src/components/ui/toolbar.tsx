'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Toolbar row above a table: search on the left, filters and sort on the right. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-2.5', className)}>
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Accessible name; the placeholder is never the label. */
  label: string;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn('relative min-w-56 flex-1 sm:max-w-80', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field h-9 pl-9 pr-9"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: string;
}

/** Single-choice filter backed by a real listbox. */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
  anyLabel = 'All',
  className,
  id,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: FilterOption[];
  /** Label for the "no filter" option. Pass `null` for filters that always apply. */
  anyLabel?: string | null;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={id} className="text-[12px] font-medium text-muted">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-9 min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anyLabel === null ? null : <SelectItem value="all">{anyLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Multi-choice quick filters as pressed-state buttons (server query friendly). */
export function FilterChips({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: FilterOption[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} role="group" aria-label={label}>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors duration-150',
                active
                  ? 'border-accent-line bg-accent-soft text-accent'
                  : 'border-hairline bg-card text-body hover:border-hairline-strong hover:text-ink',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ResultCount({
  shown,
  total,
  label,
  className,
}: {
  shown: number;
  total?: number | null;
  label: string;
  className?: string;
}) {
  return (
    <p className={cn('text-[13px] text-muted', className)} aria-live="polite">
      {total != null && total !== shown
        ? `Showing ${shown} of ${total} ${label}.`
        : `${shown} ${shown === 1 ? label.replace(/s$/, '') : label}.`}
    </p>
  );
}

/**
 * Paging.
 *
 * The list endpoints return the most recent records, so this pages in the
 * browser over what the API returned. It is honest about that: the count line
 * above always states how many records the current page holds.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className={cn('flex items-center justify-between gap-3', className)} aria-label="Pagination">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
        Previous
      </Button>
      <p className="text-[13px] text-muted" aria-current="page">
        Page {page} of {pageCount}
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
      >
        Next
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </Button>
    </nav>
  );
}

/** Simple in-browser pagination so every list uses the same maths. */
export function usePagination<T>(items: T[], pageSize = 20) {
  const [page, setPage] = React.useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  const slice = React.useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );
  React.useEffect(() => {
    setPage(1);
  }, [items.length]);
  return { page: current, pageCount, slice, setPage };
}
