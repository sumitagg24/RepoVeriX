'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * DataTable — one dense, sortable table for every list surface (findings,
 * scans, repositories, website audits, members).
 *
 * Design intent: security work is tabular. Cards-for-everything hides the
 * scan-comparison a reviewer actually needs. Columns are declared by the
 * caller so each surface keeps its own semantics while the chrome, sorting,
 * empty state and responsive behaviour stay identical.
 */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T, index: number) => ReactNode;
  /** Provide to make the column sortable. Nullish values always sort last. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
  width?: string;
  className?: string;
  headClassName?: string;
  /** Stacked mobile layouts keep the key columns; the rest hide below this. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

export type SortDirection = 'asc' | 'desc';

function hideClass(hideBelow?: 'sm' | 'md' | 'lg') {
  if (hideBelow === 'sm') return 'hidden sm:table-cell';
  if (hideBelow === 'md') return 'hidden md:table-cell';
  if (hideBelow === 'lg') return 'hidden lg:table-cell';
  return undefined;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  initialSortKey,
  initialSortDirection = 'asc',
  dense = true,
  caption,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Rendered instead of the table when there are no rows. */
  empty?: ReactNode;
  initialSortKey?: string;
  initialSortDirection?: SortDirection;
  dense?: boolean;
  /** Screen-reader description of what the table contains. */
  caption?: string;
  className?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [direction, setDirection] = useState<SortDirection>(initialSortDirection);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sortKey, direction, columns]);

  function toggle(key: string) {
    if (sortKey === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('asc');
    }
  }

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/60 bg-card', className)}>
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => {
              const sortable = Boolean(column.sortValue);
              const active = sortKey === column.key;
              return (
                <TableHead
                  key={column.key}
                  className={cn(
                    'h-9 px-3 text-[11px]',
                    hideClass(column.hideBelow),
                    column.align === 'right' && 'text-right',
                    column.headClassName
                  )}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={
                    active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wider transition-colors hover:text-foreground',
                        active ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {column.header}
                      {active ? (
                        direction === 'asc' ? (
                          <ArrowUp className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden="true" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    <span className="font-semibold uppercase tracking-wider text-muted-foreground">
                      {column.header}
                    </span>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, index) => (
            <TableRow key={getRowKey(row, index)} className="data-row">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    dense ? 'px-3 py-2' : 'px-3 py-3',
                    hideClass(column.hideBelow),
                    column.align === 'right' && 'text-right',
                    column.className
                  )}
                >
                  {column.cell(row, index)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
