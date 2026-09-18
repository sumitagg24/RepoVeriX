import * as React from 'react';
import { FileCode2, GitBranch, Play, Route, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { CodeExcerpt } from '@/components/ui/code';
import { PathValue } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { EVIDENCE_KIND_LABEL } from '@/lib/domain';
import type { Evidence } from '@/types/api';

/**
 * Evidence chain.
 *
 * The product's whole claim is that a finding can be followed back to the lines
 * that produced it, so this is the surface that has to be readable: one step per
 * hop in recorded order, each with its file, its lines and its snippet, plus the
 * description the analyzer wrote so the chain still means something to a reader
 * who does not want to parse code first.
 *
 * Order is the point, so the steps render as an ordered list with a visible
 * rail. The kind icons are decorative and every one of them is paired with its
 * written label.
 */
const KIND_ICON: Record<string, { tone: 'critical' | 'medium' | 'info' | 'accent' | 'verified'; icon: React.ReactNode }> = {
  source_input: { tone: 'critical', icon: <Upload className="size-3.5" aria-hidden="true" /> },
  sink: { tone: 'critical', icon: <Play className="size-3.5" aria-hidden="true" /> },
  transformation: { tone: 'medium', icon: <Route className="size-3.5" aria-hidden="true" /> },
  call_relationship: { tone: 'medium', icon: <GitBranch className="size-3.5" aria-hidden="true" /> },
  static_analysis: { tone: 'info', icon: <FileCode2 className="size-3.5" aria-hidden="true" /> },
  dependency: { tone: 'info', icon: <FileCode2 className="size-3.5" aria-hidden="true" /> },
  test: { tone: 'verified', icon: <Play className="size-3.5" aria-hidden="true" /> },
  llm_reasoning: { tone: 'accent', icon: <FileCode2 className="size-3.5" aria-hidden="true" /> },
};

export function EvidenceChain({ evidence }: { evidence: Evidence[] }) {
  const ordered = React.useMemo(
    () =>
      [...evidence].sort(
        (a, b) =>
          (a.order_index ?? 0) - (b.order_index ?? 0) ||
          (a.line_start ?? 0) - (b.line_start ?? 0),
      ),
    [evidence],
  );

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={<FileCode2 className="size-4" aria-hidden="true" />}
        title="No evidence chain recorded"
        body="This finding has no steps attached, which usually means the configuration that produced it does not record chains. Check the scan configuration before acting on the claim."
      />
    );
  }

  return (
    <ol className="space-y-0">
      {ordered.map((item, index) => {
        const style = KIND_ICON[item.kind] ?? {
          tone: 'info' as const,
          icon: <FileCode2 className="size-3.5" aria-hidden="true" />,
        };
        const last = index === ordered.length - 1;
        const lines =
          item.line_start != null
            ? `line ${item.line_start}${item.line_end && item.line_end !== item.line_start ? ` to ${item.line_end}` : ''}`
            : null;

        return (
          <li key={item.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="grid size-7 shrink-0 place-items-center rounded-md border border-hairline bg-card text-muted">
                {style.icon}
              </span>
              {!last ? <span className="mt-1 w-px flex-1 bg-hairline" aria-hidden="true" /> : null}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <Badge tone={style.tone}>{EVIDENCE_KIND_LABEL[item.kind] ?? item.kind}</Badge>
                {item.file_path ? <PathValue path={item.file_path} /> : null}
                {lines ? <span className="font-mono text-[11.5px] text-faint">{lines}</span> : null}
              </div>

              <p className="mt-2 max-w-[76ch] text-[13.5px] leading-relaxed text-body">
                {item.description}
              </p>

              {item.snippet ? (
                <div className="mt-3">
                  <CodeExcerpt
                    code={item.snippet}
                    startLine={item.line_start ?? 1}
                    label={item.file_path ?? undefined}
                    tone={item.kind === 'sink' ? 'critical' : 'accent'}
                    maxHeight="max-h-72"
                  />
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
