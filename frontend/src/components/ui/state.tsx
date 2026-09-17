'use client';

import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-error';

/**
 * Shared state primitives — every page uses these for empty / error states
 * so the product speaks with one voice:
 * what is empty, why, and what to do next.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  ctaHref,
  ctaLabel,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Custom action (e.g. a button opening a dialog) — used instead of the link CTA. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-4 py-8 text-center', className)}>
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground/70">
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      {action ? (
        <div className="mt-4">{action}</div>
      ) : (
        ctaHref && ctaLabel && (
          <Button asChild variant="outline" size="sm" className="mt-4 gap-1.5">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        )
      )}
    </div>
  );
}

export function QueryError({
  error,
  onRetry,
  title = 'Couldn’t load this data',
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center px-4 py-8 text-center',
        className
      )}
    >
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {getApiErrorMessage(error)}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
