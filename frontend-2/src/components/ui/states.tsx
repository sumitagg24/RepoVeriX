'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Lock, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * State vocabulary.
 *
 * Every list, table and detail screen has five shapes: loading, empty, error,
 * forbidden, and plan-limited. They live here so they look and read the same
 * everywhere, and none of them is a bare spinner or a blank region.
 */

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn('skeleton block h-4 w-full', className)} aria-hidden="true" />;
}

/** Text skeleton: `lines` rows of decreasing width, matching real paragraph shape. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span
          key={index}
          className={cn('skeleton block h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** Table skeleton: header row plus body rows, so layout does not jump on load. */
export function SkeletonTable({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn('panel overflow-hidden', className)} aria-hidden="true">
      <div className="flex gap-4 border-b border-hairline bg-surface px-4 py-2.5">
        {Array.from({ length: columns }).map((_, index) => (
          <span key={index} className="skeleton h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-hairline">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <span
                key={columnIndex}
                className={cn('skeleton h-3.5 flex-1', columnIndex === 0 && 'max-w-56')}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Announces loading to assistive tech while the skeleton is purely visual. */
export function LoadingRegion({
  label = 'Loading',
  className,
  children,
}: {
  label?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  secondaryAction,
  steps,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  steps?: { label: string; done?: boolean }[];
  className?: string;
}) {
  return (
    <div className={cn('panel px-6 py-10 text-center sm:px-10 sm:py-14', className)}>
      <div className="mx-auto flex max-w-lg flex-col items-center">
        {icon ? (
          <span className="mb-4 grid size-10 place-items-center rounded-md border border-hairline bg-surface text-muted">
            {icon}
          </span>
        ) : null}
        <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
        <div className="mt-2 text-[13.5px] leading-relaxed text-muted">{body}</div>
        {steps && steps.length > 0 ? (
          <ol className="mt-5 w-full space-y-2 text-left">
            {steps.map((step, index) => (
              <li
                key={step.label}
                className="flex items-center gap-3 rounded-md border border-hairline px-3 py-2 text-[13px] text-body"
              >
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-medium',
                    step.done
                      ? 'bg-verified-soft text-verified'
                      : 'bg-surface-strong text-muted',
                  )}
                >
                  {index + 1}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
        ) : null}
        {action || secondaryAction ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  body,
  detail,
  onRetry,
  retryLabel = 'Try again',
  action,
  className,
}: {
  title?: string;
  body: React.ReactNode;
  detail?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('panel border-critical-line px-5 py-6 sm:px-6', className)} role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-body">{body}</p>
          {detail ? (
            <p className="mt-2 break-words font-mono text-[12px] text-muted">{detail}</p>
          ) : null}
          {onRetry || action ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {onRetry ? (
                <Button size="sm" variant="secondary" onClick={onRetry}>
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  {retryLabel}
                </Button>
              ) : null}
              {action}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn('flex items-start gap-1.5 text-[12.5px] text-critical', className)}
      role="alert"
    >
      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/** 403: the account is real, the permission is not there. */
export function ForbiddenState({
  title = 'You do not have access to this view',
  body = 'Your role does not include this page. Ask a workspace owner or admin to change your role, or return to the overview.',
  className,
}: {
  title?: string;
  body?: string;
  className?: string;
}) {
  return (
    <EmptyState
      className={className}
      icon={<Lock className="size-4" aria-hidden="true" />}
      title={title}
      body={body}
      action={
        <Button asChild size="sm">
          <Link href="/dashboard">Back to overview</Link>
        </Button>
      }
    />
  );
}

/** 402: the feature exists and the plan does not include it. */
export function UpgradeState({
  title = 'Not included in your current plan',
  body,
  reason,
  className,
}: {
  title?: string;
  body?: React.ReactNode;
  reason?: string | null;
  className?: string;
}) {
  return (
    <div className={cn('panel px-5 py-6 sm:px-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-[14.5px] font-semibold text-ink">{title}</h3>
            <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-body">{body}</p>
            {reason ? (
              <p className="mt-2 font-mono text-2xs text-muted">
                {reason.replace(/-/g, ' ')}
              </p>
            ) : null}
          </div>
        </div>
        <Button asChild size="sm" variant="primary" className="shrink-0">
          <Link href="/billing">
            Compare plans
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/** 401 after a stored token was rejected. */
export function SessionExpiredState({ className }: { className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={<Lock className="size-4" aria-hidden="true" />}
      title="Your session ended"
      body="The stored session was rejected by the API. Sign in again to continue where you left off."
      action={
        <Button asChild size="sm">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      }
    />
  );
}
