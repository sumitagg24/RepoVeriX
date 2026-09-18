import Link from 'next/link';

import type { Finding } from '@/types/api';

/**
 * RiskExplanation — the reasoning, as prose with dividers.
 *
 * Three separate cards for description / impact / recommendation implied three
 * equally-weighted peers. They are not peers: the description is the claim, the
 * impact is what makes it worth reading, and the recommendation is the way out.
 * A single column with rules between them reads as one argument.
 */

function Block({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2 border-t border-border/60 pt-5 first:border-t-0 first:pt-0 md:grid-cols-[9rem_1fr] md:gap-6">
      <div>
        <p className="mono-label">{label}</p>
        <h2 className="mt-1 text-sm font-semibold leading-snug">{title}</h2>
      </div>
      <div className="min-w-0 max-w-[68ch] space-y-3 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function RiskExplanation({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-5">
      <Block label="Claim" title="What was detected">
        <p className="whitespace-pre-wrap text-foreground/90">{finding.description}</p>
      </Block>

      {finding.impact && (
        <Block label="Impact" title="Why it matters">
          <p className="whitespace-pre-wrap">{finding.impact}</p>
        </Block>
      )}

      <Block label="Repair" title="Documented fix">
        {finding.recommendation ? (
          <p className="whitespace-pre-wrap">{finding.recommendation}</p>
        ) : (
          <p className="italic">
            No repair guidance was recorded for this finding. Generate a candidate patch from the
            Verification tab — it will be graded on whether it removes the sink, not on whether it
            reads plausibly.
          </p>
        )}
        <p className="font-mono text-[11px]">
          Rule{' '}
          <Link
            href="/detections"
            className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
          >
            {finding.external_id}
          </Link>{' '}
          · matched by {finding.source}
        </p>
      </Block>
    </div>
  );
}
