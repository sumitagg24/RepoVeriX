import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Crumb {
  href?: string;
  label: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-xs transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn(last && 'text-body')} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight className="size-3 text-faint" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Workspace page header: title, one line of context, and at most two actions.
 * Detail pages pass the entity name as `title` and the section as `crumbs`.
 */
export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
  /** Small facts under the title: state badges, counts, timestamps. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('border-b border-hairline pb-6', className)}>
      {crumbs && crumbs.length > 0 ? <Breadcrumbs items={crumbs} className="mb-3" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-ink sm:text-[26px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-[70ch] text-[13.5px] leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {meta ? <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">{meta}</div> : null}
    </header>
  );
}
