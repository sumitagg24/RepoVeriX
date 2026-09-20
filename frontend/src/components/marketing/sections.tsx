import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  FileCode2,
  GitBranch,
  Lock,
  Route,
  ShieldCheck,
  Upload,
  Wrench,
} from 'lucide-react';

import { Badge, SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeExcerpt } from '@/components/ui/code';
import { PathValue } from '@/components/ui/misc';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { cn } from '@/lib/utils';
import { Reveal } from '@/components/marketing/motion';
import { DistributionBar } from '@/components/ui/metric';
import { Table, TableFrame, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { SAMPLE_FINDINGS } from '@/lib/samples';

/**
 * Home page sections.
 *
 * The page argues in one direction: what a finding has to answer, how triage
 * works on it, and what verification proves. Each section is a different
 * layout family (centred band, hanging bento, full-width data surface,
 * asymmetric collage, list), and colour arrives as a surface the product rests
 * on. Nothing here is a page-wide gradient, and no picture invents a widget the
 * workspace does not render.
 */

export type FaqEntry = { question: string; answer: string };

// -------------------------------------------------------------- capability bento

const OUTCOMES = [
  {
    title: 'Prioritise what is reachable',
    body: 'Severity, confidence and entry-point reachability are recorded separately, so a critical item with no path to execution does not outrank a high item with one.',
    icon: Route,
  },
  {
    title: 'See how risk reaches production',
    body: 'Every finding names the untrusted input, the transformation and the sink it lands in, with the lines that prove each step.',
    icon: GitBranch,
  },
  {
    title: 'Hand engineers a path forward',
    body: 'Findings carry the surrounding code, the rule that fired and a candidate repair, so the review starts from context instead of a severity label.',
    icon: Wrench,
  },
  {
    title: 'Verify before you close',
    body: 'A repair is applied to a copy of the snapshot, executed in a sandbox, and recorded with its exit codes. Verification is the difference between fixed and assumed fixed.',
    icon: ShieldCheck,
  },
] as const;

/**
 * The bento.
 *
 * Four panels, two rows, unequal widths: the wide panel carries the argument and
 * the samples, the narrow one carries the proof. Each panel holds a white plate,
 * which is where all the text lives, so a washed surface never has to carry
 * contrast on its own.
 */
export function OutcomeGrid() {
  return (
    <Section>
      <Shell width="wide">
        <SectionHeading
          align="center"
          title="Every finding answers four questions"
          lead="RepoVeriX is judged on the decisions it makes easier: what to fix, whether it is real, and whether the repair worked."
        />

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <Panel
              wash="cobalt"
              tone="deep"
              title={OUTCOMES[0].title}
              body={OUTCOMES[0].body}
              icon={OUTCOMES[0].icon}
            >
              <div className="float-plate p-4 sm:p-5">
                <DistributionBar
                  label="Severity distribution"
                  segments={[
                    { label: 'Critical', value: 1, tone: 'critical' },
                    { label: 'High', value: 3, tone: 'high' },
                    { label: 'Medium', value: 1, tone: 'medium' },
                    { label: 'Low', value: 2, tone: 'low' },
                  ]}
                />
                <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                  {SAMPLE_FINDINGS.slice(0, 3).map((finding) => (
                    <li key={finding.title} className="flex items-start gap-3 py-3">
                      <SeverityBadge severity={finding.severity} compact />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium leading-snug text-ink">
                          {finding.title}
                        </span>
                        <span className="mt-1 block">
                          <PathValue path={finding.path} />
                        </span>
                      </span>
                      <VerdictBadge status={finding.verdict} />
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.05} className="lg:col-span-5">
            <Panel
              wash="amber"
              tone="pale"
              title={OUTCOMES[1].title}
              body={OUTCOMES[1].body}
              icon={OUTCOMES[1].icon}
            >
              <div className="float-plate overflow-hidden">
                <ol className="divide-y divide-hairline">
                  {CHAIN_STEPS.map((step, index) => (
                    <li key={step.kind} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-hairline bg-surface font-mono text-[10.5px] text-muted">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-medium text-ink">
                          {step.kind}
                        </span>
                        <span className="mt-0.5 block break-words font-mono text-[11.5px] text-body">
                          {step.detail}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-faint">
                          {step.at}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={0.05} className="lg:col-span-5">
            <Panel
              wash="teal"
              tone="pale"
              title={OUTCOMES[2].title}
              body={OUTCOMES[2].body}
              icon={OUTCOMES[2].icon}
            >
              <CodeExcerpt
                code={`- query = f"SELECT * FROM users WHERE name = '{term}'"
+ query = "SELECT * FROM users WHERE name = ?"
+ cursor.execute(query, (term,))`}
                startLine={43}
                tone="accent"
                label="candidate patch · app/search.py"
                maxHeight="max-h-36"
              />
            </Panel>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-7">
            <Panel
              wash="plum"
              tone="pale"
              title={OUTCOMES[3].title}
              body={OUTCOMES[3].body}
              icon={OUTCOMES[3].icon}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="float-plate p-4">
                  <p className="text-[12.5px] font-medium text-ink">Verification run</p>
                  <ul className="mt-3 space-y-2.5">
                    {SANDBOX_FACTS.slice(0, 3).map((fact) => (
                      <li key={fact.label} className="flex items-start gap-2.5">
                        <BadgeCheck
                          className="mt-0.5 size-3.5 shrink-0 text-verified"
                          aria-hidden="true"
                        />
                        <span className="text-[12.5px] leading-snug text-body">{fact.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="float-plate p-4">
                  <p className="text-[12.5px] font-medium text-ink">Recorded outcome</p>
                  <div className="mt-3 space-y-2">
                    <Row label="Exit code" value="0" />
                    <Row label="Tests run" value="42" />
                    <Row label="Detector after patch" value="clean" />
                    <Row label="Runtime" value="38s" />
                  </div>
                </div>
              </div>
            </Panel>
          </Reveal>
        </div>
      </Shell>
    </Section>
  );
}

/**
 * A washed panel with its own white plate.
 *
 * `tone="deep"` keeps white text on every gradient stop; `tone="pale"` mixes the
 * accent into the card colour so the panel follows the theme and dark ink stays
 * legible in both.
 */
function Panel({
  wash,
  tone,
  title,
  body,
  icon: Icon,
  children,
  className,
}: {
  wash: 'cobalt' | 'teal' | 'amber' | 'plum';
  tone: 'deep' | 'pale';
  title: string;
  body: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  const deep = tone === 'deep';
  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-lg p-5 sm:p-6',
        `wash-${wash}`,
        deep ? 'wash-panel' : 'wash-plate',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-md',
            deep ? 'bg-white/15 text-white' : 'border border-hairline bg-card text-accent',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <h3
          className={cn(
            'text-[16.5px] font-semibold leading-snug',
            deep ? 'text-white' : 'text-ink',
          )}
        >
          {title}
        </h3>
      </div>
      <p
        className={cn(
          'mt-3 max-w-[62ch] text-[13.5px] leading-relaxed',
          deep ? 'text-white/90' : 'text-body',
        )}
      >
        {body}
      </p>
      <div className="mt-5 flex-1">{children}</div>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2 last:border-0 last:pb-0">
      <span className="text-[12.5px] text-muted">{label}</span>
      <span data-numeric className="font-mono text-[12px] text-ink">
        {value}
      </span>
    </div>
  );
}

const CHAIN_STEPS = [
  { kind: 'Source of untrusted input', detail: 'request.args.get("q")', at: 'app/search.py:42' },
  { kind: 'Transformation', detail: 'f-string interpolation', at: 'app/search.py:43' },
  { kind: 'Sink', detail: 'cursor.execute(query)', at: 'app/search.py:44' },
];

const SANDBOX_FACTS = [
  { label: 'Patch applied to a copy of the stored snapshot' },
  { label: 'Dependencies resolved inside the sandbox' },
  { label: 'Generated test fails before the patch and passes after' },
  { label: 'Static re-analysis no longer fires the detector' },
];

// -------------------------------------------------------------- triage surface

const SAMPLE_ROWS = [
  {
    severity: 'critical' as const,
    title: 'SQL injection in the search endpoint',
    rule: 'sql-injection',
    path: 'app/search.py:44',
    verdict: 'verified' as const,
    age: '2 days',
  },
  {
    severity: 'high' as const,
    title: 'Command built from an unvalidated argument',
    rule: 'command-injection',
    path: 'services/report.py:88',
    verdict: 'probable' as const,
    age: '2 days',
  },
  {
    severity: 'medium' as const,
    title: 'Weak hashing function used for cache keys',
    rule: 'insecure-hash',
    path: 'app/cache.py:12',
    verdict: 'verified' as const,
    age: '6 days',
  },
  {
    severity: 'low' as const,
    title: 'Debug flag readable from the environment',
    rule: 'debug-enabled',
    path: 'settings/base.py:31',
    verdict: 'rejected' as const,
    age: '11 days',
  },
];

/**
 * Triage.
 *
 * One full-width data surface instead of a card grid: this is the shape the
 * findings list actually has, and the filters above it are the ones the product
 * ships. Colour is confined to the severity column.
 */
export function TriageSurface() {
  return (
    <Section bordered>
      <Shell width="wide">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            title="Triage on the two facts that decide it"
            lead="Severity says how bad a failure would be. The verdict says whether it is real. Sorting on both, with the file and the line in the same row, is what makes a 400-finding backlog workable."
          />
          <div className="flex flex-wrap gap-2">
            {['Critical 1', 'High 3', 'Medium 1', 'Low 2'].map((chip) => (
              <span key={chip} className="chip">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <Reveal className="mt-8">
          <TableFrame label="Sample findings">
            <Table minWidth="min-w-[780px]">
              <caption className="sr-only">
                Sample findings with severity, rule, location and validation verdict
              </caption>
              <THead>
                <TR>
                  <TH>Severity</TH>
                  <TH>Finding</TH>
                  <TH>Rule</TH>
                  <TH>Location</TH>
                  <TH>Verdict</TH>
                  <TH align="right">Age</TH>
                </TR>
              </THead>
              <TBody>
                {SAMPLE_ROWS.map((row) => (
                  <TR key={row.title}>
                    <TD>
                      <SeverityBadge severity={row.severity} compact />
                    </TD>
                    <TD>
                      <span className="text-[13.5px] font-medium leading-snug text-ink">
                        {row.title}
                      </span>
                    </TD>
                    <TD>
                      <span className="font-mono text-[12px] text-muted">{row.rule}</span>
                    </TD>
                    <TD>
                      <PathValue path={row.path} />
                    </TD>
                    <TD>
                      <VerdictBadge status={row.verdict} />
                    </TD>
                    <TD align="right" numeric>
                      {row.age}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        </Reveal>

        <p className="mt-4 text-[12.5px] text-muted">
          Sample records. Your workspace renders the same table from live scan data.
        </p>
      </Shell>
    </Section>
  );
}

// -------------------------------------------------------------- verification

/**
 * Verification.
 *
 * The one section where colour is allowed to carry the argument: a deep panel
 * and a white plate overlapping, tilted, with the sandbox's own facts beneath
 * them in plain rows.
 */
export function VerificationSurface() {
  return (
    <Section>
      <Shell width="wide">
        <SectionHeading
          align="center"
          title="A repair is not done until it runs"
          lead="A candidate patch is applied to a copy of the snapshot and executed in an isolated sandbox. The finding is only closed when the run proves it, and the exit codes are kept as evidence."
        />

        <Reveal className="mt-12">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <div className="wash-panel wash-cobalt flex flex-col justify-between rounded-lg p-6">
              <div>
                <p className="text-[12.5px] font-medium text-white/85">Before verification</p>
                <h3 className="mt-2 text-[20px] font-semibold leading-snug text-white">
                  A candidate patch is a suggestion, not a fix
                </h3>
                <p className="mt-3 max-w-[42ch] text-[13.5px] leading-relaxed text-white/90">
                  Generated repairs are shown with their reasoning and their diff. Until a run
                  reproduces the issue and then clears it, the finding stays open.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-medium text-white">
                  <Boxes className="size-3" aria-hidden="true" />
                  sandboxed
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-medium text-white">
                  <Lock className="size-3" aria-hidden="true" />
                  read-only snapshot
                </span>
              </div>
            </div>

            <div className="float-plate p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <BadgeCheck className="size-4 text-verified" aria-hidden="true" />
                  Verification run · scan 41
                </span>
                <Badge tone="verified">Verified</Badge>
              </div>

              <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                {SANDBOX_FACTS.map((fact) => (
                  <li key={fact.label} className="flex items-start gap-3 py-3">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-verified" aria-hidden="true" />
                    <span className="text-[13px] leading-relaxed text-body">{fact.label}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Exit code', value: '0' },
                  { label: 'Tests', value: '42' },
                  { label: 'Duration', value: '38s' },
                  { label: 'Detector', value: 'clean' },
                ].map((item) => (
                  <div key={item.label} className="rounded-md border border-hairline bg-surface px-3 py-2.5">
                    <p className="text-[11.5px] text-muted">{item.label}</p>
                    <p data-numeric className="mt-1 font-mono text-[13px] text-ink">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </Shell>
    </Section>
  );
}

// -------------------------------------------------------------- faq

/** Questions and answers as a definition list: each pair is one reading unit. */
export function FaqList({ entries, className }: { entries: readonly FaqEntry[]; className?: string }) {
  return (
    <dl className={className}>
      {entries.map((entry) => (
        <div
          key={entry.question}
          className="grid grid-cols-1 gap-2 border-t border-hairline py-5 sm:grid-cols-[18rem_minmax(0,1fr)] sm:gap-8"
        >
          <dt className="text-[14.5px] font-medium text-ink">{entry.question}</dt>
          <dd className="max-w-[68ch] text-[13.5px] leading-relaxed text-body">{entry.answer}</dd>
        </div>
      ))}
    </dl>
  );
}

// -------------------------------------------------------------- closing

/**
 * Closing call to action.
 *
 * Centred and short, on a warm plate: the page has already made its argument by
 * this point, so the only job left is the next step.
 */
export function ClosingCta({
  title = 'Point it at one repository and read a finding',
  body = 'The free plan runs deterministic analysis on three repositories with no provider key required.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Section>
      <Shell>
        <div className="wash-plate wash-cobalt rounded-lg px-6 py-12 text-center sm:px-10 sm:py-16">
          <h2 className="mx-auto max-w-[26ch] text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[40px]">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-body">{body}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="primary">
              <Link href="/auth/sign-up">
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs/getting-started">Read the setup guide</Link>
            </Button>
          </div>
        </div>
      </Shell>
    </Section>
  );
}

// ------------------------------------------------------------ misc cards

/** Small facts used by the product and solutions pages. */
export function FactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-hairline py-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
      <div>
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-body">{value}</p>
      </div>
    </div>
  );
}

export const SECTION_ICONS = { FileCode2, ScanSearch: FileCode2, Upload };
