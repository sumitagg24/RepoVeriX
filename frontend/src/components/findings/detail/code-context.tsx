import { CodeViewer } from '@/components/system/code';
import type { Evidence } from '@/types/api';
import { FileCode2 } from 'lucide-react';

/**
 * CodeContext — the file, the span, and the code itself.
 *
 * The finding record carries a location but not a snippet; the snippet lives on
 * the evidence rows the detectors emitted. So this section prefers a snippet
 * from the evidence at the finding's own location and, when there is none,
 * says so plainly rather than rendering an empty code box that implies the
 * tool looked and found nothing.
 */
export function CodeContext({
  filePath,
  lineStart,
  lineEnd,
  evidence,
}: {
  filePath: string;
  lineStart: number | null;
  lineEnd: number | null;
  evidence?: Evidence[];
}) {
  const span =
    lineStart && lineEnd && lineEnd !== lineStart ? `${lineStart}–${lineEnd}` : lineStart ? `${lineStart}` : null;

  const own = (evidence ?? [])
    .filter((e) => e.snippet && e.file_path === filePath && e.line_start === lineStart)
    .sort((a, b) => a.order_index - b.order_index)[0];

  const fallback = (evidence ?? [])
    .filter((e) => Boolean(e.snippet))
    .sort((a, b) => a.order_index - b.order_index)[0];

  const snippet = own ?? fallback;
  const language = snippet?.file_path?.split('.').pop();

  return (
    <section aria-label="Code context" className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="mono-label">Code</p>
        <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{filePath}</span>
          {span && <span className="shrink-0 text-muted-foreground">:{span}</span>}
        </p>
      </div>

      {snippet ? (
        <>
          <CodeViewer code={snippet.snippet ?? ''} language={language} maxHeight={320} />
          {!own && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              No snippet was captured at this exact location; showing the earliest captured evidence
              for this finding ({snippet.file_path ?? 'unknown file'}
              {snippet.line_start ? `:${snippet.line_start}` : ''}).
            </p>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
          No code snippet was captured for this finding. Evidence rows below still record the exact
          file and line of each step.
        </div>
      )}
    </section>
  );
}
