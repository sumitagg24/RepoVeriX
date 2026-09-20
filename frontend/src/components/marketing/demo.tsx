'use client';

import * as React from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { Pause, Play } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/button';
import {
  SampleFindingPreview,
  SamplePipeline,
  SampleRepositoryRow,
} from '@/components/marketing/product-frame';
import { DEMO_STEPS } from '@/lib/samples';
import { cn } from '@/lib/utils';

/**
 * The walkthrough.
 *
 * Four steps, in the order of the work: connect, scan, read, verify. The panel
 * advances on its own once it is in view so a reader who does nothing still sees
 * the sequence, and it stops the moment they hover, focus or press pause. Under
 * `prefers-reduced-motion` nothing advances at all: the steps become tabs and
 * the first one renders immediately.
 *
 * Every panel is a real component from the product (the pipeline list, the
 * repository row, the finding view), not a picture of one.
 */
const STEP_MS = 5200;

export function ProductDemo() {
  const reduced = useReducedMotion();
  const container = React.useRef<HTMLDivElement>(null);
  const inView = useInView(container, { amount: 0.4, once: false });
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const running = !reduced && inView && !paused;

  React.useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % DEMO_STEPS.length);
    }, STEP_MS);
    return () => window.clearTimeout(timer);
  }, [running, active]);

  const step = DEMO_STEPS[active];

  return (
    <div
      ref={container}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-10">
        <div>
          <ol className="space-y-0">
            {DEMO_STEPS.map((item, index) => {
              const current = index === active;
              const done = index < active;
              return (
                <li key={item.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'group flex w-full items-start gap-3.5 rounded-md px-3 py-3 text-left transition-colors duration-200',
                      current ? 'bg-surface' : 'hover:bg-surface/60',
                    )}
                  >
                    <span className="mt-0.5 flex flex-col items-center gap-1.5">
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]',
                          current
                            ? 'border-accent bg-accent text-on-accent'
                            : done
                              ? 'border-verified-line bg-verified-soft text-verified'
                              : 'border-hairline bg-card text-muted',
                        )}
                      >
                        {index + 1}
                      </span>
                      {index < DEMO_STEPS.length - 1 ? (
                        <span className="h-full w-px flex-1 bg-hairline" aria-hidden="true" />
                      ) : null}
                    </span>
                    <span className="min-w-0 pb-1">
                      <span className="block text-[13.5px] font-medium text-ink">{item.label}</span>
                      <span
                        className={cn(
                          'mt-0.5 block text-[13px] leading-relaxed',
                          current ? 'text-body' : 'text-muted',
                        )}
                      >
                        {item.title}
                      </span>
                    </span>
                  </button>
                  {current && running ? (
                    <motion.span
                      key={active}
                      className="absolute inset-x-3 bottom-1 h-px origin-left bg-accent"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: STEP_MS / 1000, ease: 'linear' }}
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>

          {!reduced ? (
            <div className="mt-4 flex items-center gap-2.5 px-3">
              <IconButton
                label={paused ? 'Resume the walkthrough' : 'Pause the walkthrough'}
                variant="secondary"
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? (
                  <Play className="size-3.5" aria-hidden="true" />
                ) : (
                  <Pause className="size-3.5" aria-hidden="true" />
                )}
              </IconButton>
              <span className="text-[12.5px] text-muted">
                {paused ? 'Paused' : `Step ${active + 1} of ${DEMO_STEPS.length}`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="panel overflow-hidden shadow-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-2.5">
              <span className="font-mono text-[11.5px] text-muted">
                payments-api · {step.label.toLowerCase()}
              </span>
              <Badge tone="neutral">Sample data</Badge>
            </div>
            <div aria-live="polite" className="min-h-[19rem]">
              <DemoPanel step={step.id} />
            </div>
          </div>
          <p className="mt-3 max-w-[80ch] text-[13px] leading-relaxed text-muted">{step.body}</p>
        </div>
      </div>
    </div>
  );
}

function DemoPanel({ step }: { step: string }) {
  if (step === 'connect') {
    return (
      <div>
        <SampleRepositoryRow />
        <div className="border-t border-hairline px-4 py-4 sm:px-5">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Import path', value: 'GitHub OAuth' },
              { label: 'Snapshot', value: 'stored on import' },
              { label: 'Writes to source', value: 'never' },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[12px] text-muted">{row.label}</dt>
                <dd className="mt-0.5 font-mono text-[12px] text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className="px-4 py-5 sm:px-5">
        <SamplePipeline />
      </div>
    );
  }

  if (step === 'finding') {
    return <SampleFindingPreview />;
  }

  return (
    <div className="px-4 py-5 sm:px-5">
      <ul className="divide-y divide-hairline border-t border-hairline">
        {[
          { label: 'Patch applied to a copy of the snapshot', state: 'passed' },
          { label: 'Dependencies resolved', state: 'passed' },
          { label: 'Generated test reproduces the issue', state: 'passed' },
          { label: 'Finding no longer detected', state: 'passed' },
          { label: 'Existing test suite', state: 'not run' },
        ].map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-3">
            <span className="text-[13.5px] text-body">{row.label}</span>
            <span
              className={cn(
                'shrink-0 text-[12.5px] font-medium',
                row.state === 'passed' ? 'text-verified' : 'text-muted',
              )}
            >
              {row.state}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        Checks that were not run say so. A verification record is not a pass: it is what happened.
      </p>
    </div>
  );
}
