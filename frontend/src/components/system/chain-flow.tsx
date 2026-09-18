'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  ArrowRight,
  Database,
  FileCode2,
  FlaskConical,
  GitBranch,
  LogIn,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

/**
 * RVX ChainFlow — the signature RepoVeriX visual.
 *
 * SOURCE → ANALYSIS → EVIDENCE → RISK → REPAIR → VERIFIED, as one ordered,
 * inspectable chain. It renders every step as real text (kind, label, detail,
 * location), so the visual *is* the accessible representation — there is no
 * canvas or SVG graph that would need a separate text alternative, and no
 * invented nodes: callers pass only what the API actually returned.
 *
 * Motion is deliberately cheap and meaningful:
 *  - nodes reveal with a staggered opacity + translate transform,
 *  - connector lines draw downward with a scaleY transform,
 *  - both are compositor-only properties (no layout, no paint storms).
 * The sequence starts when the chain scrolls into view, never on every render,
 * and collapses to an instant reveal under `prefers-reduced-motion`.
 */

export type ChainStatus = 'confirmed' | 'absent' | 'unknown' | 'active';

export type ChainStep = {
  /** Machine kind from the API, e.g. `source_input`, `sink`, `patch`. */
  kind: string;
  /** Human label — a location, function name or claim. */
  label: string;
  /** Optional one-line explanation from the API. */
  detail?: string;
  /** Optional mono metadata, e.g. `app.py:41` or `tainted_from_parameter`. */
  meta?: string;
  status?: ChainStatus;
};

/** Kind → icon. First matching keyword wins, so the map stays small. */
const ICON_RULES: { match: RegExp; icon: typeof Database }[] = [
  { match: /input|source|entry|request|param/i, icon: LogIn },
  { match: /transform|sanitiz|build|assemble|propagat/i, icon: Sparkles },
  { match: /sink|execute|query|database|db/i, icon: Database },
  { match: /static|analys|detect|scan|rule/i, icon: ScanSearch },
  { match: /patch|repair|fix|edit|diff/i, icon: Wrench },
  { match: /test|regression|reproduc/i, icon: FlaskConical },
  { match: /git|commit|history|blame/i, icon: GitBranch },
  { match: /verif|proof|validat|confirm/i, icon: ShieldCheck },
];

function iconFor(kind: string) {
  return ICON_RULES.find((rule) => rule.match.test(kind))?.icon ?? FileCode2;
}

const STATUS_LABEL: Record<ChainStatus, string> = {
  confirmed: 'confirmed',
  absent: 'absent',
  unknown: 'not determined',
  active: 'current step',
};

/**
 * Full literal class names, not a `chain-status-${status}` template.
 * The chain-status rules live in `@layer components` in globals.css, which
 * Tailwind purges by scanning source text for the complete class name — a
 * template string is invisible to that scan, so the modifier classes would
 * silently never reach the stylesheet. Verified in the browser, not assumed.
 */
const STATUS_CLASS: Record<ChainStatus, string> = {
  confirmed: 'chain-status-confirmed',
  active: 'chain-status-active',
  absent: 'chain-status-absent',
  unknown: '',
};

/** Maps a chain status onto the existing `.chip` + `.state-*` token classes. */
function statusClass(status?: ChainStatus) {
  switch (status) {
    case 'confirmed':
      return 'state-verified-soft';
    case 'active':
      return 'state-observed-soft';
    case 'absent':
      return 'state-rejected-soft';
    default:
      return '';
  }
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ChainFlow({
  steps,
  label = 'Evidence chain',
  className,
  animate = true,
}: {
  steps: ChainStep[];
  label?: string;
  className?: string;
  animate?: boolean;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const [revealed, setRevealed] = useState(!animate);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
  }, []);

  // Reveal once, when the chain enters the viewport. Falls back to revealed if
  // IntersectionObserver is unavailable, so the content is never hidden.
  useEffect(() => {
    if (!animate || revealed) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animate, revealed]);

  if (steps.length === 0) return null;

  return (
    <ol ref={ref} aria-label={label} className={cn('chain-flow', className)}>
      {steps.map((step, i) => {
        const Icon = iconFor(step.kind);
        const status = step.status ?? 'unknown';
        const isLast = i === steps.length - 1;
        const delay = reduced ? 0 : i * 70;

        return (
          <li
            key={`${step.kind}-${i}`}
            className="chain-step relative flex gap-3 pb-5 last:pb-0"
            data-status={status}
            style={{
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'none' : 'translateY(6px)',
              transition: reduced
                ? undefined
                : `opacity 320ms ease-out ${delay}ms, transform 320ms ease-out ${delay}ms`,
            }}
          >
            {!isLast && (
              <span
                aria-hidden="true"
                className="chain-connector absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px origin-top"
                style={{
                  transform: revealed ? 'scaleY(1)' : 'scaleY(0)',
                  transition: reduced ? undefined : `transform 260ms ease-out ${delay + 90}ms`,
                }}
              />
            )}

            <span className="chain-node" aria-hidden="true">
              <Icon className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <p className="mono-label">{step.kind.replaceAll('_', ' ')}</p>
                {step.meta && (
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{step.meta}</p>
                )}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug">{step.label}</p>
              {step.detail && (
                <p className="mt-1 break-words text-[13px] leading-relaxed text-muted-foreground">
                  {step.detail}
                </p>
              )}
            </div>

            <div className="hidden shrink-0 items-start gap-2 pt-0.5 sm:flex">
              {status !== 'unknown' && (
                <span className={cn('chain-status', STATUS_CLASS[status])}>
                  {STATUS_LABEL[status]}
                </span>
              )}
              <span className="mono-label tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            </div>
            {/* Screen readers get the status even when the visual chip is hidden. */}
            <span className="sr-only">
              Step {i + 1} of {steps.length}. {STATUS_LABEL[status]}.
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Horizontal form of the same chain, for surfaces with width but no height
 * (hero panels, PR summaries). Wraps rather than scrolls so nothing is cut off,
 * and stays fully textual.
 */
export function ChainFlowInline({
  steps,
  className,
}: {
  steps: { label: string; status?: ChainStatus }[];
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-2', className)}>
      {steps.map((step, i) => (
        <li key={`${step.label}-${i}`} className="flex items-center gap-1.5">
          <span className={cn('chip', statusClass(step.status))}>
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          )}
        </li>
      ))}
    </ol>
  );
}
