'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Machine artifacts.
 *
 * Code, diffs, paths and hashes get one consistent treatment: monospace, a
 * hairline frame, a label that names the file, and their own scroll container so
 * a long line never widens the page.
 */
function splitLines(value: string): string[] {
  return value.replace(/\n$/, '').split('\n');
}

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1 text-[11.5px] font-medium text-muted transition-colors hover:bg-surface hover:text-ink',
        className,
      )}
    >
      {copied ? (
        <Check className="size-3" aria-hidden="true" />
      ) : (
        <Copy className="size-3" aria-hidden="true" />
      )}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function CodeExcerpt({
  code,
  startLine = 1,
  highlight,
  label,
  tone = 'accent',
  maxHeight = 'max-h-[24rem]',
  className,
}: {
  code: string;
  startLine?: number;
  highlight?: { start: number; end: number } | null;
  label?: string;
  tone?: 'accent' | 'critical';
  maxHeight?: string;
  className?: string;
}) {
  const lines = splitLines(code);
  const highlightClass =
    tone === 'critical'
      ? 'bg-critical-soft text-ink'
      : 'bg-accent-soft text-ink';

  return (
    <figure className={cn('code-surface min-w-0 overflow-hidden', className)}>
      {label ? (
        <figcaption className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-3 py-1.5">
          <span className="truncate font-mono text-[11.5px] text-muted">{label}</span>
          <CopyButton value={code} label="Copy code" />
        </figcaption>
      ) : null}
      <div className={cn('overflow-auto', maxHeight)}>
        <table className="w-full border-collapse">
          <caption className="sr-only">Code excerpt with line numbers</caption>
          <tbody>
            {lines.map((line, index) => {
              const lineNumber = startLine + index;
              const flagged =
                highlight && lineNumber >= highlight.start && lineNumber <= highlight.end;
              return (
                <tr key={`${lineNumber}-${index}`} className={cn(flagged && highlightClass)}>
                  <td
                    className="w-10 select-none border-r border-hairline px-2 text-right align-top text-faint"
                    aria-hidden="true"
                  >
                    {lineNumber}
                  </td>
                  <td className="whitespace-pre px-3 align-top text-ink">
                    <code>{line || ' '}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** Unified diff: markers carry the meaning, colour only reinforces it. */
export function DiffView({
  diff,
  label,
  className,
}: {
  diff: string;
  label?: string;
  className?: string;
}) {
  const lines = splitLines(diff);
  const additions = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
  const deletions = lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length;

  return (
    <figure className={cn('code-surface min-w-0 overflow-hidden', className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-3 py-1.5">
        <span className="truncate font-mono text-[11.5px] text-muted">{label ?? 'Candidate patch'}</span>
        <span className="flex items-center gap-2 text-[11.5px] text-muted">
          <span className="text-verified">+{additions}</span>
          <span className="text-critical">-{deletions}</span>
          <CopyButton value={diff} label="Copy patch" />
        </span>
      </figcaption>
      <div className="max-h-[26rem] overflow-auto">
        <pre className="min-w-0 px-3 py-2 text-[12px] leading-[1.7]">
          {lines.map((line, index) => {
            const isAdd = line.startsWith('+') && !line.startsWith('+++');
            const isRemove = line.startsWith('-') && !line.startsWith('---');
            const isHunk = line.startsWith('@@');
            return (
              <div
                key={index}
                className={cn(
                  'whitespace-pre-wrap break-words',
                  isAdd && 'bg-verified-soft text-verified',
                  isRemove && 'bg-critical-soft text-critical',
                  isHunk && 'text-accent',
                  !isAdd && !isRemove && !isHunk && 'text-body',
                )}
              >
                {line || ' '}
              </div>
            );
          })}
        </pre>
      </div>
    </figure>
  );
}

/** Inline mono for paths, rule IDs, hashes and other machine identifiers. */
export function MonoValue({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn('break-words font-mono text-[12px] text-body', className)}
    >
      {children}
    </span>
  );
}
