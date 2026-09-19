import * as React from 'react';
import { FileCode2, GitBranch, Play, Upload } from 'lucide-react';

import { CodeExcerpt } from '@/components/ui/code';
import { PathValue } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/states';
import { EVIDENCE_KIND_LABEL, TONE_STYLES, type Tone } from '@/lib/domain';
import { cn } from '@/lib/utils';
import type { Evidence } from '@/types/api';

/**
 * Evidence chain.
 *
 * The product's central claim is that a finding can be followed back to the
 * lines that produced it, so this is the part of the page that has to be
 * readable: one step per hop, in the order the analyser recorded, each with its
 * file, its lines, its snippet and a written description — so the chain still
 * makes sense to someone who does not read the code.
 */

type KindStyle = { tone: Tone; icon: React.ElementType };

const KIND_STYLE: Record<string, KindStyle> = {
  source_input: { tone: 'critical', icon: Upload },
  sink: { tone: 'critical', icon: Play },
  transformation: { tone: 'medium', icon: GitBranch },
  call_relationship: { tone: 'medium', icon: GitBranch },
  static_analysis: { tone: 'primary', icon: FileCode2 },
  dependency: { tone: 'primary', icon: FileCode2 },
  test: { tone: 'verified', icon: Play },
  llm_reasoning: { tone: 'primary', icon: FileCode2 },
};

const FALLBACK: KindStyle = { tone: 'neutral', icon: FileCode2 };

export function EvidenceChain({ evidence }: { evidence: Evidence[] }) {
  const ordered = React.useMemo(
    () =>
      [...evidence].sort(
        (a, b) =>
          (a.order_index ?? 0) - (b.order_index ?? 0) || (a.line_start ?? 0) - (b.line_start ?? 0),
      ),
    [evidence],
  );

  if (ordered.length === 0) {
    return (
      <EmptyState
        title="No evidence chain recorded"
        body="This finding has no steps attached. That usually means it came from a configuration that records only the claim — check the scan configuration before acting on it."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {ordered.map((item, index) => {
        const style = KIND_STYLE[item.kind] ?? FALLBACK;
        const Icon = style.icon;
        const label = EVIDENCE_KIND_LABEL[item.kind] ?? item.kind.replace(/_/g, ' ');
        const lines =
          item.line_start == null
            ? null
            : item.line_end && item.line_end !== item.line_start
              ? `lines ${item.line_start}–${item.line_end}`
              : `line ${item.line_start}`;

        return (
          <li key={item.id} className="relative border-t border-hairline pt-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border',
                    TONE_STYLES[style.tone].badge,
                  )}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">
                    <span className="text-muted">{index + 1}. </span>
                    {label}
                  </p>
                  {item.description ? (
                    <p className="mt-1 max-w-[76ch] text-[13px] leading-relaxed text-body">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>
              {item.file_path ? (
                <p className="flex shrink-0 items-baseline gap-2 font-mono text-[11.5px] text-muted">
                  <PathValue path={item.file_path} />
                  {lines ? <span className="text-faint">{lines}</span> : null}
                </p>
              ) : null}
            </div>

            {item.snippet ? (
              <div className="mt-3">
                <CodeExcerpt
                  code={item.snippet}
                  startLine={item.line_start ?? 1}
                  label={item.file_path ?? 'snippet'}
                  maxHeight="max-h-56"
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
