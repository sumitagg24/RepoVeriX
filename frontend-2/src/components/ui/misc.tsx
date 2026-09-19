'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { CopyButton } from '@/components/ui/code';
import { cn } from '@/lib/utils';

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function InlineCode({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'rounded-xs border border-hairline bg-surface px-1 py-px font-mono text-[12px] text-body',
        className,
      )}
    >
      {children}
    </code>
  );
}

/** An identifier worth copying: commit SHA, repository id, rule id. */
export function CopyableValue({
  value,
  label,
  display,
  className,
}: {
  value: string;
  label: string;
  display?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="break-words font-mono text-[12px] text-body">{display ?? value}</span>
      <CopyButton value={value} label={`Copy ${label}`} className="shrink-0" />
    </span>
  );
}

/** A file path, broken safely and titled with the full value. */
export function PathValue({ path, className }: { path: string; className?: string }) {
  const segments = path.split('/');
  const file = segments.pop() ?? path;
  const directory = segments.join('/');

  return (
    <span className={cn('break-all font-mono text-[12px] text-body', className)} title={path}>
      {directory ? <span className="text-muted">{directory}/</span> : null}
      <span className="text-ink">{file}</span>
    </span>
  );
}

export function StatusDot({
  tone = 'neutral',
  pulse = false,
  className,
}: {
  tone?: 'neutral' | 'accent' | 'critical' | 'high' | 'medium' | 'low' | 'verified' | 'info';
  pulse?: boolean;
  className?: string;
}) {
  const fill = {
    neutral: 'bg-neutral-400',
    accent: 'bg-accent',
    critical: 'bg-critical',
    high: 'bg-high',
    medium: 'bg-medium',
    low: 'bg-low',
    verified: 'bg-verified',
    info: 'bg-info',
  }[tone];

  return (
    <span
      className={cn('inline-flex size-2 shrink-0 rounded-full', fill, pulse && 'animate-pulse-soft', className)}
      aria-hidden="true"
    />
  );
}

export function Avatar({
  name,
  src,
  size = 28,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <AvatarPrimitive.Root
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-md border border-hairline bg-surface text-[11.5px] font-medium text-body',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback delayMs={src ? 300 : 0}>{initials || '?'}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
