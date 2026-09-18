'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneHue } from '@/lib/tone';

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
    <div className={cn('overflow-hidden rounded-lg border border-border/60 bg-card/40', className)}>
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {language ?? 'code'}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <Check className={cn('h-3.5 w-3.5', toneHue('verified'))} />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-auto" style={{ maxHeight }} tabIndex={0} role="region" aria-label={`Code viewer${language ? ` (${language})` : ''}`}>
        <pre className="min-w-max p-0 font-mono text-[13px] leading-6">
          {lines.map((line, i) => {
            const n = i + 1;
            const marked = marks.has(n);
            return (
              <div key={n} className={cn('flex hover:bg-accent/20 transition-colors', marked ? 'bg-primary/12 border-l-2 border-l-primary' : 'odd:bg-muted/15')}>
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-12 shrink-0 select-none pr-3 text-right tabular-nums font-medium',
                    marked ? 'text-primary font-bold' : 'text-muted-foreground/60'
                  )}
                >
                  {n}
                </span>
                <code className={cn('flex-1 whitespace-pre pr-4', marked && 'font-semibold text-foreground')}>{line || ' '}</code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

export type DiffLine = { kind: 'add' | 'del' | 'ctx' | 'hunk'; text: string; oldNo?: number; newNo?: number };

/**
 * Parse a unified diff into DiffLines with line numbers. Tolerates missing
 * hunk headers — lines without @@ headers are numbered from 1 per side.
 */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      out.push({ kind: 'hunk', text: raw });
      continue;
    }
    if (raw.startsWith('+++') || raw.startsWith('---')) {
      out.push({ kind: 'hunk', text: raw });
      continue;
    }
    if (raw.startsWith('+')) {
      out.push({ kind: 'add', text: raw.slice(1), newNo: newNo || undefined });
      if (newNo) newNo += 1;
    } else if (raw.startsWith('-')) {
      out.push({ kind: 'del', text: raw.slice(1), oldNo: oldNo || undefined });
      if (oldNo) oldNo += 1;
    } else {
      const text = raw.startsWith(' ') ? raw.slice(1) : raw;
      out.push({
        kind: 'ctx',
        text,
        oldNo: oldNo || undefined,
        newNo: newNo || undefined,
      });
      if (oldNo) oldNo += 1;
      if (newNo) newNo += 1;
    }
  }
  return out;
}

export function DiffViewer({ lines, className }: { lines: DiffLine[]; className?: string }) {
  const [copied, setCopied] = useState(false);
  const raw = lines.map((l) => `${l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '}${l.text}`).join('\n');
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border/60 bg-card/40', className)}>
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          diff
        </span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(raw);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch { /* noop */ }
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Copy diff to clipboard"
        >
          {copied ? (
            <Check className={cn('h-3.5 w-3.5', toneHue('verified'))} />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="overflow-auto" style={{ maxHeight: 440 }} tabIndex={0} role="region" aria-label="Diff viewer">
        <pre className="min-w-max font-mono text-[13px] leading-6">
          {lines.map((l, i) =>
            l.kind === 'hunk' ? (
              <div key={i} className="bg-muted/40 px-3 py-1 text-muted-foreground text-xs font-medium">
                {l.text}
              </div>
            ) : (
              <div
                key={i}
                className={cn(
                  'flex hover:bg-accent/10 transition-colors',
                  // Diff tint at a deliberately low alpha, but still read from the
                  // verified / critical tokens so it tracks both themes.
                  l.kind === 'add' &&
                    'bg-[hsl(var(--state-verified)/0.12)] text-[hsl(var(--state-verified-ink))]',
                  l.kind === 'del' &&
                    'bg-[hsl(var(--sev-critical)/0.12)] text-[hsl(var(--sev-critical-ink))]'
                )}
              >
                <span aria-hidden="true" className="w-12 shrink-0 select-none pr-3 text-right tabular-nums font-medium opacity-60">
                  {l.kind === 'add' ? l.newNo ?? '' : l.oldNo ?? ''}
                </span>
                <span aria-hidden="true" className="w-5 shrink-0 select-none opacity-75 font-semibold">
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
