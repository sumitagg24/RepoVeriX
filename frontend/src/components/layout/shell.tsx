import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Layout.
 *
 * One container, one vertical rhythm. Sections are full-width bands separated by
 * hairlines; nothing floats in a card unless it is a repeated item or a tool.
 */
export function Shell({
  children,
  width = 'default',
  className,
}: {
  children: React.ReactNode;
  width?: 'default' | 'wide' | 'prose';
  className?: string;
}) {
  const widths = {
    default: 'max-w-[1200px]',
    wide: 'max-w-[1400px]',
    prose: 'max-w-[760px]',
  } as const;

  return (
    <div className={cn('mx-auto w-full px-5 sm:px-8 lg:px-10', widths[width], className)}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
  muted = false,
  as: Component = 'section',
  bordered = false,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** A tinted band. Used at most twice per page so the rhythm stays calm. */
  muted?: boolean;
  as?: React.ElementType;
  bordered?: boolean;
}) {
  return (
    <Component
      id={id}
      className={cn(
        'relative py-16 sm:py-20 lg:py-24',
        muted && 'bg-surface/60',
        bordered && 'border-t border-hairline',
        className,
      )}
    >
      {children}
    </Component>
  );
}

/**
 * Section heading.
 *
 * Deliberately stacked rather than the "big headline left, filler paragraph
 * right" split, and the eyebrow is optional and rationed: at most one eyebrow
 * per three sections on a page, never one above every heading.
 */
export function SectionHeading({
  title,
  lead,
  eyebrow,
  align = 'left',
  className,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  eyebrow?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-2xl text-center', className)}>
      {eyebrow ? <p className="caption-upper mb-3">{eyebrow}</p> : null}
      <h2 className="text-[26px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-body">{lead}</p>
      ) : null}
    </div>
  );
}
