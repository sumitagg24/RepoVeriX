import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Data tables.
 *
 * Wide tables are the one place horizontal scrolling is allowed, so the scroll
 * happens inside a labelled, keyboard-focusable region instead of the page.
 * Numeric columns use tabular figures and right alignment.
 */
export function TableFrame({
  children,
  label,
  className,
  maxHeight,
}: {
  children: React.ReactNode;
  /** Describes what the table holds, for the scroll region and the caption. */
  label: string;
  className?: string;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn('panel relative overflow-x-auto', className)}
      style={maxHeight ? { maxHeight } : undefined}
      role="region"
      aria-label={`${label} (scrollable table)`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function Table({
  children,
  className,
  minWidth = 'min-w-[720px]',
}: {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <table className={cn('w-full border-collapse text-left text-[13.5px]', minWidth, className)}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-surface">{children}</thead>;
}

export function TBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tbody className={cn('divide-y divide-hairline', className)}>{children}</tbody>;
}

export function TR({
  children,
  className,
  onClick,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** Rows that navigate render a real link in the first cell; the row itself
   *  stays non-interactive markup so screen readers get one clear target. */
  href?: string;
}) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150 hover:bg-card-hover',
        (onClick || href) && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
  align = 'left',
  width,
  scope = 'col',
}: {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  scope?: 'col' | 'row';
}) {
  return (
    <th
      scope={scope}
      style={width ? { width } : undefined}
      className={cn(
        'whitespace-nowrap border-b border-hairline px-4 py-2.5 text-[12px] font-medium text-muted',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  align = 'left',
  numeric = false,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      data-numeric={numeric || undefined}
      className={cn(
        'px-4 py-3 align-middle text-body',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        numeric && 'font-mono text-[12.5px] tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  );
}
