import { CodeViewer } from '@/components/system/code';
import { ChainFlow } from '@/components/system/chain-flow';
import { EmptyState } from '@/components/ui/state';
import type { Evidence } from '@/types/api';
import { Search } from 'lucide-react';

/**
 * EvidenceSection — the chain, then the same chain with every node opened up.
 *
 * The summary visual and the inspectable detail are two views of one array, so
 * they cannot drift apart: both read `evidence` sorted by `order_index`, which
 * is the order the detectors actually emitted.
 */
export function EvidenceSection({ evidence }: { evidence?: Evidence[] }) {
  const ordered = [...(evidence ?? [])].sort((a, b) => a.order_index - b.order_index);

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="No evidence recorded"
        body="Evidence nodes appear here once detectors and validators report them for this finding. A finding without evidence is a claim, not a result."
      />
    );
  }

  return (
    <div className="space-y-7">
      <ChainFlow
        label="Evidence chain, source to sink"
        steps={ordered.map((e) => ({
          kind: e.kind,
          label: e.file_path ? `${e.file_path}${e.line_start ? `:${e.line_start}` : ''}` : 'No location recorded',
          detail: e.description,
          meta: e.kind === 'static_analysis' ? undefined : `${e.kind.replaceAll('_', ' ')} step`,
          status: 'confirmed' as const,
        }))}
      />

      <div className="space-y-5 border-t border-border/60 pt-6">
        <p className="mono-label">Node detail</p>
        {ordered.map((evidence) => (
          <article key={evidence.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="mono-label">
                {String(evidence.order_index + 1).padStart(2, '0')} · {evidence.kind.replaceAll('_', ' ')}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {evidence.file_path ? `${evidence.file_path}:${evidence.line_start ?? '?'}` : 'no location'}
              </span>
            </div>
            <p className="max-w-[72ch] whitespace-pre-wrap text-[13px] leading-relaxed">
              {evidence.description}
            </p>
            {evidence.snippet && (
              <CodeViewer
                code={evidence.snippet}
                language={evidence.file_path?.split('.').pop()}
                maxHeight={240}
              />
            )}
            {Object.keys(evidence.metadata ?? {}).length > 0 && (
              <details className="group">
                <summary className="cursor-pointer font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                  metadata
                </summary>
                <div className="mt-2">
                  <CodeViewer
                    code={JSON.stringify(evidence.metadata, null, 2)}
                    language="json"
                    maxHeight={220}
                  />
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
