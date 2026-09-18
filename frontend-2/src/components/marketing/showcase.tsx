'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Showcase cards and their rail.
 *
 * The public surface needs to show the product, not describe it, and five
 * subjects is too many to stack full width. So each subject gets a card with a
 * colour identity (one of the five spotlights) on its header band, and the real
 * interface underneath on a white plate. The cards sit in a horizontal rail on
 * narrow screens and scroll with real controls rather than a scroll hint.
 *
 * Colour lives on the header band only. Everything inside the plate is the same
 * interface the workspace renders, so the marketing page never invents a widget
 * to fill space.
 */
export type Spotlight = 'cobalt' | 'teal' | 'amber' | 'plum' | 'slate';

const WASH: Record<Spotlight, string> = {
  cobalt: 'wash-cobalt',
  teal: 'wash-teal',
  amber: 'wash-amber',
  plum: 'wash-plum',
  slate: 'wash-slate',
};

export function ShowcaseCard({
  wash,
  title,
  meta,
  caption,
  className,
  children,
}: {
  wash: Spotlight;
  title: string;
  meta?: string;
  caption?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'wash flex w-[20rem] flex-col overflow-hidden rounded-lg sm:w-[23rem]',
        WASH[wash],
        className,
      )}
    >
      <header className="wash-head px-5 py-4">
        <h3 className="text-[16px] font-semibold leading-snug">{title}</h3>
        {meta ? <p className="mt-1 text-[12px] text-white/85">{meta}</p> : null}
      </header>
      <div className="flex-1 p-3.5 sm:p-4">
        <div className="float-plate h-full overflow-hidden">{children}</div>
      </div>
      {caption ? (
        <p className="border-t border-black/5 px-5 py-3 text-[12.5px] leading-relaxed text-body">
          {caption}
        </p>
      ) : null}
    </article>
  );
}

/**
 * Horizontal rail with working prev/next controls.
 *
 * The controls are the accessible way to move through the rail; native touch
 * scrolling and horizontal wheel gestures still work, and the rail exposes
 * `role="region"` named by its heading so a screen reader can enter and leave it.
 */
export function ShowcaseRail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const measure = React.useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    setAtStart(node.scrollLeft <= 4);
    setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    measure();
    const node = scroller.current;
    if (!node) return;
    node.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      node.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const nudge = (direction: 1 | -1) => {
    const node = scroller.current;
    if (!node) return;
    const step = Math.min(node.clientWidth * 0.8, 480);
    node.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-end gap-2 px-5 sm:px-8 lg:px-10">
        <Button
          size="icon"
          variant="secondary"
          aria-label={`Scroll ${label} left`}
          disabled={atStart}
          onClick={() => nudge(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          aria-label={`Scroll ${label} right`}
          disabled={atEnd}
          onClick={() => nudge(1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div
        ref={scroller}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="rail mt-3 focus-visible:outline-none"
      >
        {children}
      </div>
    </div>
  );
}
