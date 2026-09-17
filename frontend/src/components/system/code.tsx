'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * RVX CodeViewer + DiffViewer — investigation-grade, dependency-free.
 * Line numbers, evidence-line highlighting, copy, horizontal scroll inside
 * the viewer (never page overflow), mono type, reduced-motion safe.
 */

export function CodeViewer({
  code,
  language,
  highlightLines,
  maxHeight = 420,
  className,
}: {
  code: string;
  language?: string;
  highlightLines?: number[];
  maxHeight?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const marks = new Set(highlightLines ?? []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — selection still works */
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {language ?? 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Copy code to clipboard"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-auto" style={{ maxHeight }} tabIndex={0} role="region" aria-label={`Code viewer${language ? ` (${language})` : ''}`}>
        <pre className="min-w-max p-0 font-mono text-[12.5px] leading-6">
          {lines.map((line, i) => {
            const n = i + 1;
            const marked = marks.has(n);
            return (
              <div key={n} className={cn('flex', marked ? 'bg-primary/10' : 'odd:bg-muted/20')}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-12 shrink-0 select-none pr-3 text-right tabular-nums',
                    marked ? 'text-primary' : 'text-muted-foreground/50'
                  )}
                >
                  {n}
                </span>
                <code className={cn('flex-1 whitespace-pre pr-4', marked && 'font-medium')}>{line || ' '}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export type DiffLine = { kind: 'add' | 'del' | 'ctx' | 'hunk'; text: string; oldNo?: number; newNo?: number };

export function DiffViewer({ lines, className }: { lines: DiffLine[]; className?: string }) {
  const [copied, setCopied] = useState(false);
  const raw = lines.map((l) => `${l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}${l.text}`).join('\n');
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">diff</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(raw);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch { /* noop */ }
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Copy diff to clipboard"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 440 }} tabIndex={0} role="region" aria-label="Diff viewer">
        <pre className="min-w-max font-mono text-[12.5px] leading-6">
          {lines.map((l, i) =>
            l.kind === 'hunk' ? (
              <div key={i} className="bg-muted/60 px-3 py-0.5 text-muted-foreground">{l.text}</div>
            ) : (
              <div
                key={i}
                className={cn(
                  'flex',
                  l.kind === 'add' && 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
                  l.kind === 'del' && 'bg-red-500/10 text-red-900 dark:text-red-200'
                )}
              >
                <span aria-hidden="true" className="w-10 shrink-0 select-none pr-2 text-right tabular-nums opacity-50">
                  {l.kind === 'add' ? l.newNo ?? '' : l.oldNo ?? ''}
                </span>
                <span aria-hidden="true" className="w-4 shrink-0 select-none opacity-70">
                  {l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}
                </span>
                <code className="flex-1 whitespace-pre pr-4">{l.text || ' '}</code>
              </div>
            )
          )}
        </pre>
      </div>
    </div>
  );
}
