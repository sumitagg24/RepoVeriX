'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Copy, Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/system/page-header';
import { CodeViewer } from '@/components/system/code';
import { SeverityBadge } from '@/components/system/severity-badge';
import { VerdictBadge } from '@/components/system/verdict-badge';
import { FindingFeedbackBar } from '@/components/app/finding-feedback-bar';
import { FindingChat } from '@/components/findings/finding-chat';
import { ImpactPanel } from '@/components/findings/impact-panel';
import { CodeContext } from '@/components/findings/detail/code-context';
import { VerificationChecks } from '@/components/findings/detail/verification-checks';
import { VerificationPanel } from '@/components/findings/detail/verification-panel';
import { PatchesPanel } from '@/components/findings/detail/patches-panel';
import { SignalSpine, type SpineStep } from '@/components/rvx/spine';
import { ConsoleEmpty, Panel, Rule, StageTag } from '@/components/rvx/primitives';
import { useFinding, useGenerateFix } from '@/hooks/useFindings';
import { usePatches } from '@/hooks/usePatches';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatConfidence } from '@/lib/evidence';
import type { Evidence, FindingValidationResult, RunTestResponse } from '@/types/api';

/**
 * Finding investigation workspace.
 *
 * Replaces the previous version of this screen, which opened with a header and
 * then hid its most important content — the reasoning, the evidence and the
 * verification — behind a four-tab control. Tabs are the wrong affordance here:
 * an investigation is read top to bottom, and every section answers the next
 * question in that read.
 *
 * The document is therefore numbered, in the order an engineer actually asks:
 *
 *   01 what happened      the claim, and what it would cost
 *   02 where it occurs    the real lines, in the real file
 *   03 how it propagates  the signal spine — source, transforms, sink
 *   04 repair             the candidate patch
 *   05 verification       what a sandbox run actually proved
 *   06 blast radius       what else depends on this
 *   07 ask                interrogate the finding with its own context
 *
 * The right rail is a case file: a section index plus the provenance you
 * reference repeatedly while reading. It is sticky, so the reader never has to
 * scroll back to check a rule id or a line number.
 */

const SECTIONS = [
  { id: 'happened', n: '01', label: 'What happened' },
  { id: 'location', n: '02', label: 'Where it occurs' },
  { id: 'propagation', n: '03', label: 'How it propagates' },
  { id: 'repair', n: '04', label: 'Repair' },
  { id: 'verification', n: '05', label: 'Verification' },
  { id: 'impact', n: '06', label: 'Blast radius' },
  { id: 'ask', n: '07', label: 'Ask RepoVeriX' },
];

export default function FindingInvestigationPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: finding, isLoading } = useFinding(id);
  const { data: patches, isLoading: patchesLoading } = usePatches({ finding_id: id });
  const generateFix = useGenerateFix();

  const [validation, setValidation] = useState<FindingValidationResult | null>(null);
  const [runResult, setRunResult] = useState<RunTestResponse | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading finding">
        <div className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded-sm bg-muted/70" />
          <div className="h-8 w-2/3 animate-pulse rounded-sm bg-muted/60" />
          <div className="h-3 w-1/3 animate-pulse rounded-sm bg-muted/40" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="h-80 animate-pulse rounded-[var(--radius-md)] bg-muted/40" />
          <div className="h-64 animate-pulse rounded-[var(--radius-md)] bg-muted/30" />
        </div>
      </div>
    );
  }

  if (!finding) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Findings', href: '/findings' }, { label: 'Not found' }]} />
        <ConsoleEmpty
          title="This finding is not available"
          body="It may have been removed with its scan, or belong to another workspace. Findings are owned by the scan that produced them."
          action={
            <Button asChild size="sm">
              <Link href="/findings">Back to the explorer</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const orderedEvidence: Evidence[] = [...(finding.evidence ?? [])].sort(
    (a, b) => a.order_index - b.order_index
  );

  const spineSteps: SpineStep[] = orderedEvidence.map((evidence) => ({
    id: evidence.id,
    kind: evidence.kind,
    label: evidence.description,
    detail:
      Object.keys(evidence.metadata ?? {}).length > 0
        ? undefined
        : evidence.file_path
          ? `${evidence.file_path}${evidence.line_start ? `:${evidence.line_start}` : ''}`
          : undefined,
    location: evidence.file_path
      ? `${evidence.file_path}${evidence.line_start ? `:${evidence.line_start}` : ''}`
      : undefined,
    snippet: evidence.snippet ?? undefined,
    status: 'confirmed',
    meta: Object.entries(evidence.metadata ?? {})
      .slice(0, 6)
      .map(([label, value]) => ({ label, value: String(value) })),
  }));

  const verifiedPatch = (patches ?? []).find((p) => p.status === 'verified');
  const fixPatch = (patches ?? []).find((p) =>
    ['verified', 'applied', 'candidate'].includes(p.status)
  );
  const location = `${finding.file_path}${finding.line_start ? `:${finding.line_start}` : ''}`;

  const copyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success('Investigation link copied'))
      .catch(() => toast.error('Could not copy the link'));
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[{ label: 'Findings', href: '/findings' }, { label: finding.title }]}
      />

      {/* ------------------------------------------------------- verdict banner */}
      <header className="border-b pb-5 rvx-hairline">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SeverityBadge severity={finding.severity} variant="solid" size="lg" />
          <VerdictBadge status={finding.status} size="lg" />
          <span className="rvx-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {finding.category.replace('_', ' ')}
          </span>
          <span className="rvx-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {finding.external_id}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1.5 text-[11px]"
            onClick={copyLink}
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy link
          </Button>
        </div>

        <h1 className="rvx-title mt-4 text-2xl sm:text-[28px]">{finding.title}</h1>

        <p className="rvx-mono mt-2 break-all text-[11px] text-muted-foreground">
          {location}
          {finding.function_name ? ` · ${finding.function_name}()` : ''}
          {' · '}
          <Link
            href={`/scans/${finding.scan_id}`}
            className="underline decoration-border underline-offset-2 hover:text-foreground"
          >
            scan {finding.scan_id.slice(0, 8)}
          </Link>
        </p>

        <div className="mt-4">
          <FindingFeedbackBar findingId={finding.id} />
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        {/* ------------------------------------------------------- the document */}
        <div className="min-w-0 space-y-10">
          {/* 01 ------------------------------------------------- what happened */}
          <section id="happened" className="scroll-mt-[120px]">
            <Rule label="01 · What happened" />
            <p className="mt-4 max-w-[70ch] whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground/90">
              {finding.description}
            </p>
            {finding.impact && (
              <Panel className="mt-5 p-4">
                <p className="rvx-eyebrow">Why it matters</p>
                <p className="mt-2 max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {finding.impact}
                </p>
              </Panel>
            )}
          </section>

          {/* 02 ------------------------------------------------------ location */}
          <section id="location" className="scroll-mt-[120px]">
            <Rule
              label="02 · Where it occurs"
              right={
                <span className="rvx-mono text-[10px] text-muted-foreground">
                  {finding.line_start
                    ? `lines ${finding.line_start}${finding.line_end && finding.line_end !== finding.line_start ? `–${finding.line_end}` : ''}`
                    : 'line not recorded'}
                </span>
              }
            />
            <div className="mt-4">
              <CodeContext
                filePath={finding.file_path}
                lineStart={finding.line_start}
                lineEnd={finding.line_end}
                evidence={finding.evidence}
              />
            </div>
          </section>

          {/* 03 -------------------------------------------------- propagation */}
          <section id="propagation" className="scroll-mt-[120px]">
            <Rule
              label="03 · How it propagates"
              right={
                <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {orderedEvidence.length} node{orderedEvidence.length === 1 ? '' : 's'}
                </span>
              }
            />

            {orderedEvidence.length === 0 ? (
              <div className="mt-4">
                <ConsoleEmpty
                  title="No evidence recorded for this finding"
                  body="A finding without evidence is a claim, not a result. Re-run the analysis to collect the chain, or treat this record as unconfirmed."
                  action={
                    <Button asChild size="sm" variant="outline">
                      <Link href="/scans/new">Re-run analysis</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <StageTag stage="source" />
                  <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
                    →
                  </span>
                  <StageTag stage="transform" />
                  <span aria-hidden="true" className="rvx-mono text-[10px] text-muted-foreground">
                    →
                  </span>
                  <StageTag stage="sink" />
                </div>

                <div className="mt-4">
                  <SignalSpine
                    steps={spineSteps}
                    title="Evidence chain, in the order the detectors emitted it"
                  />
                </div>

                {/* Full node detail stays available for copy/paste into a ticket,
                    but the spine above is what carries the argument. */}
                <details className="mt-6 border-t pt-4 rvx-hairline">
                  <summary className="rvx-mono cursor-pointer text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
                    Raw evidence records ({orderedEvidence.length})
                  </summary>
                  <div className="mt-4 space-y-5">
                    {orderedEvidence.map((evidence) => (
                      <article key={evidence.id} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="rvx-eyebrow">
                            {String(evidence.order_index + 1).padStart(2, '0')} ·{' '}
                            {evidence.kind.replaceAll('_', ' ')}
                          </span>
                          <span className="rvx-mono text-[10px] text-muted-foreground">
                            {evidence.file_path
                              ? `${evidence.file_path}:${evidence.line_start ?? '?'}`
                              : 'no location'}
                          </span>
                        </div>
                        <p className="max-w-[70ch] whitespace-pre-wrap text-[13px] leading-relaxed">
                          {evidence.description}
                        </p>
                        {evidence.snippet && (
                          <CodeViewer
                            code={evidence.snippet}
                            language={evidence.file_path?.split('.').pop()}
                            maxHeight={240}
                          />
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              </>
            )}
          </section>

          {/* 04 --------------------------------------------------------- repair */}
          <section id="repair" className="scroll-mt-[120px]">
            <Rule
              label="04 · Repair"
              right={
                verifiedPatch ? (
                  <VerdictBadge status="verified" />
                ) : (
                  <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {patches?.length ?? 0} candidate{(patches?.length ?? 0) === 1 ? '' : 's'}
                  </span>
                )
              }
            />
            <div className="mt-4">
              <PatchesPanel
                findingId={id}
                patches={patches}
                loading={patchesLoading}
                generating={generateFix.isPending}
                onGenerate={() => generateFix.mutate(id)}
                generateError={generateFix.isError ? getApiErrorMessage(generateFix.error) : null}
              />
            </div>
          </section>

          {/* 05 --------------------------------------------------- verification */}
          <section id="verification" className="scroll-mt-[120px]">
            <Rule label="05 · Verification" />
            <p className="mt-3 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
              Each check below is recorded only when something actually established it — a located
              source, a traced reachability, a sandbox run. Unchecked rows are unknown, not passed.
            </p>
            <div className="mt-4 space-y-6">
              <VerificationChecks
                finding={finding}
                evidence={finding.evidence}
                validation={validation}
                hasVerifiedPatch={Boolean(verifiedPatch)}
                testRun={runResult}
              />
              <VerificationPanel
                findingId={id}
                fixPatch={fixPatch}
                validation={validation}
                onValidation={setValidation}
                runResult={runResult}
                onRunResult={setRunResult}
              />
            </div>
          </section>

          {/* 06 --------------------------------------------------------- impact */}
          <section id="impact" className="scroll-mt-[120px]">
            <Rule label="06 · Blast radius" />
            <div className="mt-4">
              <ImpactPanel findingId={id} />
            </div>
          </section>

          {/* 07 ------------------------------------------------------------ ask */}
          <section id="ask" className="scroll-mt-[120px]">
            <Rule label="07 · Ask RepoVeriX" />
            <p className="mt-3 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
              Questions are answered against this finding: its code, its evidence and its scan
              context — not from general knowledge.
            </p>
            <div className="mt-4">
              <FindingChat findingId={id} />
            </div>
          </section>

          <p className="border-t pt-4 text-[11px] leading-relaxed text-muted-foreground rvx-hairline">
            Everything on this page comes from the finding record, its evidence rows, or a run you
            started. Nothing is estimated.{' '}
            <Link
              href="/docs/concepts"
              className="underline decoration-border underline-offset-2 transition-colors hover:text-foreground"
            >
              How evidence works
            </Link>
          </p>
        </div>

        {/* ------------------------------------------------------- the case file */}
        <aside className="min-w-0 lg:sticky lg:top-[104px] lg:self-start">
          <Panel className="overflow-hidden">
            <div className="border-b p-3 rvx-hairline">
              <p className="rvx-eyebrow">On this page</p>
              <ol className="mt-2 space-y-px">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex items-baseline gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    >
                      <span className="rvx-mono text-[10px] text-muted-foreground/70">
                        {section.n}
                      </span>
                      {section.label}
                    </a>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-3">
              <p className="rvx-eyebrow">Provenance</p>
              <dl className="mt-2 divide-y rvx-hairline">
                <ProvenanceRow label="Severity" value={finding.severity} />
                <ProvenanceRow label="Verdict" value={finding.status} />
                <ProvenanceRow label="Detector" value={finding.source} />
                <ProvenanceRow label="Rule" value={finding.external_id} />
                <ProvenanceRow label="File" value={finding.file_path} />
                <ProvenanceRow
                  label="Function"
                  value={finding.function_name ? `${finding.function_name}()` : '—'}
                />
                <ProvenanceRow
                  label="First detected"
                  value={new Date(finding.created_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                />
                <ProvenanceRow
                  label="Last analyzed"
                  value={new Date(finding.updated_at).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                />
              </dl>
            </div>

            {/* Confidence is a bounded quantity, so it gets a scale rather than a
                bare number — and it is explicitly not the verdict. */}
            <div className="border-t p-3 rvx-hairline">
              <div className="flex items-baseline justify-between">
                <span className="rvx-eyebrow">Detector confidence</span>
                <span className="rvx-mono text-[11px] tabular-nums">
                  {formatConfidence(finding.confidence)}
                </span>
              </div>
              <div
                className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`Detector confidence ${Math.round(finding.confidence * 100)} percent`}
              >
                <div
                  className="h-full rounded-full bg-[hsl(var(--rvx-source))]"
                  style={{ width: `${Math.round(finding.confidence * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Reported by the detector. The verdict above comes from evidence, not this number.
              </p>
            </div>

            <div className="border-t p-3 rvx-hairline">
              <Button asChild variant="outline" size="sm" className="w-full text-xs">
                <Link href="/findings">
                  <Search className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Back to the explorer
                </Link>
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="rvx-mono min-w-0 truncate text-right text-[11px]" title={value}>
        {value}
      </dd>
    </div>
  );
}
