'use client';

import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { Stage } from '@/components/rvx/primitives';

/**
 * SignalSpine — the signature RepoVeriX artifact.
 *
 * Every security object in this product is a path: untrusted input enters at a
 * SOURCE, is carried through TRANSFORMs, reaches a SINK, and is then closed by a
 * PATCH that has to survive VERIFY. The spine renders that path, in order, as
 * real nodes with real locations.
 *
 * Interaction rules:
 *  - the returned chain is rendered immediately; nothing is hidden behind a
 *    disclosure for the sake of looking clean,
 *  - selecting a node dims the others (`data-focus`) so one path can be read at
 *    a time — this replaces the tabbed/sectioned layouts that used to split the
 *    same information across three panes,
 *  - arrow keys move the selection and Enter/Space toggles the evidence panel,
 *    because this is the primary noun of the product and must be keyboard-first,
 *  - every node is text. There is no canvas and no SVG graph here, so the visual
 *    *is* the accessible representation — no separate text alternative needed.
 */

export type SpineStepStatus = 'confirmed' | 'absent' | 'unknown';

export type SpineMeta = { label: string; value: string };

export type SpineStep = {
  /** Stable id — used for focus management and React keys. */
  id: string;
  /** Machine kind from the API, e.g. `source_input`, `transformation`, `sink`. */
  kind: string;
  /** The claim, in the product's own words. */
  label: string;
  /** One line of why this node matters. */
  detail?: string;
  /** `app.py:41` — the receipt. */
  location?: string;
  /** Function the node lives in. */
  symbol?: string;
  /** Code excerpt revealed when the node is opened. */
  snippet?: string;
  status?: SpineStepStatus;
  /** Extra key/value pairs, rendered as a mono table in the evidence panel. */
  meta?: SpineMeta[];
};

/** Maps an API `kind` onto one of the five spine stages. */
export function stageFromKind(kind: string): Stage {
  const k = kind.toLowerCase();
  if (k.includes('source') || k.includes('input') || k.includes('request') || k.includes('entry')) {
    return 'source';
  }
  if (k.includes('sink') || k.includes('exec') || k.includes('query')) return 'sink';
  if (k.includes('patch') || k.includes('fix') || k.includes('repair')) return 'patch';
  if (k.includes('verif') || k.includes('test') || k.includes('sandbox')) return 'verify';
  if (k.includes('transform') || k.includes('propagat') || k.includes('flow')) return 'transform';
  return 'neutral';
}

const STATUS_LABEL: Record<SpineStepStatus, string> = {
  confirmed: 'confirmed',
  absent: 'absent',
  unknown: 'unconfirmed',
};

export function SignalSpine({
  steps,
  title = 'Signal path',
  defaultOpenIndex = 0,
  className,
  dense = false,
}: {
  steps: SpineStep[];
  title?: string;
  defaultOpenIndex?: number;
  className?: string;
  /** Marketing weight: shorter rows, no meta table. */
  dense?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState(defaultOpenIndex);
  const [focusMode, setFocusMode] = useState(false);
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = steps.length - 1;
      let next = index;
      if (event.key === 'ArrowDown') next = Math.min(last, index + 1);
      else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = last;
      else return;
      event.preventDefault();
      setOpenIndex(next);
      buttonsRef.current[next]?.focus();
    },
    [steps.length]
  );

  if (steps.length === 0) return null;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-2">
        <span className="rvx-eyebrow">{title}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border/40" />
        <button
          type="button"
          onClick={() => setFocusMode((v) => !v)}
          aria-pressed={focusMode}
          className={cn(
            'rvx-mono rounded-[4px] px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors',
            focusMode
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title="Dim every node except the selected one"
        >
          focus
        </button>
      </div>

      <ol
        className="rvx-spine rvx-draw mt-3"
        data-focus={focusMode}
        aria-label={`${title}: ${steps.map((s) => s.label).join(' then ')}`}
      >
        {steps.map((step, index) => {
          const stage = stageFromKind(step.kind);
          const selected = index === openIndex;
          const isLast = index === steps.length - 1;
          const status = step.status ?? 'unknown';

          return (
            <li key={step.id} className="flex flex-col">
              <button
                type="button"
                ref={(el) => {
                  buttonsRef.current[index] = el;
                }}
                data-selected={selected}
                aria-expanded={selected}
                aria-controls={`spine-panel-${step.id}`}
                onClick={() => setOpenIndex(selected ? -1 : index)}
                onFocus={() => setOpenIndex(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="rvx-node rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-0"
              >
                <span className="rvx-node-marker">
                  <span className="rvx-stage-dot" data-stage={stage} aria-hidden="true">
                    <span className="rvx-mono text-[9px] font-semibold">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </span>
                  {!isLast && (
                    <span
                      className="rvx-connector rvx-connector-draw"
                      data-stage={stage}
                      aria-hidden="true"
                    />
                  )}
                </span>

                <span className="rvx-node-body block min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="rvx-eyebrow shrink-0">{step.kind}</span>
                    {step.location && (
                      <span className="rvx-mono shrink-0 text-[10px] text-muted-foreground">
                        {step.location}
                      </span>
                    )}
                    {!dense && (
                      <span
                        className={cn(
                          'rvx-mono shrink-0 text-[10px]',
                          status === 'confirmed'
                            ? 'text-[hsl(var(--rvx-verified))]'
                            : status === 'absent'
                              ? 'text-muted-foreground line-through'
                              : 'text-muted-foreground'
                        )}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    )}
                  </span>

                  <span className="mt-1 block text-[13px] font-medium leading-snug text-foreground">
                    {step.label}
                  </span>

                  {step.detail && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {step.detail}
                    </span>
                  )}
                </span>
              </button>

              {selected && (step.snippet || step.symbol || (step.meta?.length ?? 0) > 0) && (
                <div
                  id={`spine-panel-${step.id}`}
                  className="ml-7 mt-1 mb-3 border-l pl-3 rvx-hairline"
                >
                  {step.symbol && (
                    <p className="rvx-mono text-[11px] text-muted-foreground">
                      in {step.symbol}()
                    </p>
                  )}
                  {step.snippet && (
                    <pre className="mt-2 overflow-x-auto rounded-[var(--radius-sm)] bg-[hsl(var(--rvx-inset))] p-3 text-[11px] leading-relaxed text-foreground/90">
                      <code className="rvx-mono">{step.snippet}</code>
                    </pre>
                  )}
                  {!dense && (step.meta?.length ?? 0) > 0 && (
                    <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      {step.meta?.map((item) => (
                        <div key={item.label} className="flex items-baseline gap-2">
                          <dt className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {item.label}
                          </dt>
                          <dd className="rvx-mono min-w-0 truncate text-[11px] text-foreground/85">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {steps.length} node{steps.length === 1 ? '' : 's'} · arrow keys move, enter opens the
        evidence for a node.
      </p>
    </div>
  );
}
