import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  FileCode2,
  GitBranch,
  ScanSearch,
  Sparkles,
  Upload,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { CodeExcerpt } from '@/components/ui/code';
import { Shell } from '@/components/layout/shell';
import { HeroReveal, Reveal } from '@/components/marketing/motion';
import { SAMPLE_FINDINGS } from '@/lib/samples';

/**
 * Home hero.
 *
 * The first screen does three things and stops: it says what the product is,
 * gives one reason to believe it, and puts the real interface on the page. The
 * headline is centred and quiet; the composition underneath carries the weight,
 * because a reviewer understands "findings with proof" faster from a finding
 * than from a paragraph about one.
 *
 * Every surface in the collage is built from the same primitives the workspace
 * renders, and the caption says the records are samples, so the picture cannot
 * drift from the product. On small screens the layering collapses into a plain
 * column: nothing overlaps, nothing is cropped, and no fragment depends on a
 * hover to be understood.
 */
const SAMPLE = SAMPLE_FINDINGS[0];

export function HomeHero() {
  return (
    <section className="relative">
      <Shell width="wide" className="pb-14 pt-8 sm:pb-16 sm:pt-10 lg:pb-12">
        <HeroReveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="pill">
              <span className="pill-dot" aria-hidden="true" />
              Static detectors run without a model provider
            </p>
            <h1 className="mt-4 text-[38px] font-semibold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[48px] lg:text-[54px]">
              Repository security that shows its work
            </h1>
            <p className="mx-auto mt-4 max-w-[54ch] text-[16px] leading-relaxed text-body sm:text-[17px]">
              Read the evidence behind every finding, and confirm the repair before the issue is
              closed.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href="/auth/sign-up">
                  Start free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="#showcase">See a finding</Link>
              </Button>
            </div>
          </div>
        </HeroReveal>

        <Reveal delay={0.12} className="mt-9 sm:mt-11">
          <HeroCollage />
        </Reveal>
      </Shell>
    </section>
  );
}

/**
 * The collage.
 *
 * Three surfaces, one subject each: what ran, what it found, and whether the
 * repair held. They rest on a pale wash so the white plates read as screens
 * sitting on a coloured desk rather than as three floating boxes.
 */
function HeroCollage() {
  return (
    <figure className="mx-auto max-w-[78rem]">
      <div className="wash-plate wash-cobalt relative rounded-lg px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        {/* Large screens: the layered composition, tilted slightly so it reads
            as a surface at rest rather than a flat screenshot. */}
        <div className="relative hidden min-h-[18rem] lg:block">
          <div className="absolute left-0 top-4 w-[15.5rem] rotate-[-2.2deg]">
            <ScanPlate />
          </div>
          <div className="absolute left-1/2 top-0 w-[35rem] -translate-x-1/2">
            <FindingPlate />
          </div>
          <div className="absolute right-0 top-7 w-[15.5rem] rotate-[2.2deg]">
            <VerificationPlate />
          </div>
          <div className="frag frag-float bottom-0 left-[12.5rem] w-[15rem] rotate-[-1.4deg] px-3 py-2.5">
            <ChainFragment />
          </div>
        </div>

        {/* Narrow screens: the same two surfaces, in the order a reviewer would
            meet them, with no overlap and no rotation. */}
        <div className="space-y-4 lg:hidden">
          <FindingPlate />
          <VerificationPlate />
        </div>
      </div>

      <figcaption className="mt-3 text-center text-[12.5px] leading-relaxed text-muted">
        Sample records. Your workspace renders these surfaces from live scan data.
      </figcaption>
    </figure>
  );
}

/** What ran: the scans a repository has had, and the state of each one. */
function ScanPlate() {
  return (
    <div className="float-plate overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
          <ScanSearch className="size-3.5 text-muted" aria-hidden="true" />
          payments-api
        </span>
        <span className="chip">main</span>
      </div>
      <ul className="divide-y divide-hairline">
        {SCANS.map((scan) => (
          <li key={scan.id} className="px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11.5px] text-body">{scan.id}</span>
              <span className="text-[11.5px] font-medium text-verified">{scan.state}</span>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">{scan.detail}</p>
          </li>
        ))}
      </ul>
      <div className="border-t border-hairline bg-surface px-3.5 py-2.5">
        <p className="text-[11.5px] leading-relaxed text-muted">
          The snapshot is read from storage, so a rescan does not clone the repository again.
        </p>
      </div>
    </div>
  );
}

/** What it found: the claim, its location, and the verdict validation recorded. */
function FindingPlate() {
  return (
    <div className="float-plate overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-5">
        <span className="flex min-w-0 items-center gap-2.5">
          <FileCode2 className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="truncate font-mono text-[11.5px] text-muted">
            findings / payments-api / scan 41
          </span>
        </span>
        <span className="chip">Finding detail</span>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={SAMPLE.severity} />
            <VerdictBadge status={SAMPLE.verdict} />
          </div>

          <h2 className="mt-3 text-[17px] font-semibold leading-snug text-ink sm:text-[19px]">
            {SAMPLE.title}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-body">
            The term arrives from the query string and is interpolated into the statement that runs.
            The chain beside it is the reason to believe the claim, not the severity label.
          </p>
          <p className="mt-2 font-mono text-[11.5px] text-muted">
            {SAMPLE.rule} · {SAMPLE.path}
          </p>
        </div>

        <CodeExcerpt
          code={`41  def search_users(request):
42      term = request.args.get("q")
43      query = f"SELECT * FROM users WHERE name = '{term}'"
44      cursor.execute(query)`}
          startLine={41}
          highlight={{ start: 43, end: 44 }}
          tone="critical"
          label={SAMPLE.path}
          maxHeight="max-h-32"
        />
      </div>
    </div>
  );
}

/** Whether the repair held: the checks a verification run performs, in order. */
function VerificationPlate() {
  return (
    <div className="float-plate overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-hairline px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
          <BadgeCheck className="size-3.5 text-verified" aria-hidden="true" />
          Verification run
        </span>
        <span className="text-[11.5px] text-muted">sandbox</span>
      </div>
      <ul className="divide-y divide-hairline">
        {VERIFICATION_ROWS.map((row) => (
          <li key={row.label} className="flex items-start gap-2.5 px-3.5 py-2.5">
            <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-verified" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-[12.5px] leading-snug text-ink">{row.label}</span>
              <span className="mt-0.5 block text-[11.5px] text-muted">{row.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-hairline px-3.5 py-2.5">
        <p className="flex items-center gap-2 text-[12px] font-medium text-verified">
          <BadgeCheck className="size-3.5" aria-hidden="true" />
          Finding closed as verified
        </p>
      </div>
    </div>
  );
}

/** The chain, reduced to a fragment that hangs off the finding plate. */
function ChainFragment() {
  return (
    <>
      <p className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
        <GitBranch className="size-3 text-muted" aria-hidden="true" />
        Evidence chain · 3 steps
      </p>
      <ol className="mt-2 space-y-1.5">
        {CHAIN.map((step) => (
          <li key={step.kind} className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-faint">
              {step.kind}
            </span>
            <span className="truncate font-mono text-[11px] text-body">{step.at}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** What the product reads and imports today. Facts, not social proof. */
export function TrustStrip() {
  return (
    <section aria-label="What RepoVeriX reads today" className="border-y border-hairline">
      <Shell width="wide" className="py-6">
        <dl className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
          {FACTS.map((fact) => (
            <div key={fact.label} className="flex items-start gap-3">
              <fact.icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                <dt className="text-[12.5px] font-medium text-ink">{fact.label}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{fact.value}</dd>
              </span>
            </div>
          ))}
        </dl>
      </Shell>
    </section>
  );
}

const SCANS = [
  { id: 'scan 41', state: 'Completed', detail: '7 findings · static + evidence validation' },
  { id: 'scan 40', state: 'Completed', detail: '4 findings · 2 verified repairs' },
  { id: 'scan 39', state: 'Failed', detail: 'Snapshot could not be extracted' },
];

const VERIFICATION_ROWS = [
  { label: 'Patch applied to a copy of the snapshot', detail: 'No conflicts against the branch' },
  { label: 'Dependencies resolved in the sandbox', detail: 'requirements.txt, 38 packages' },
  { label: 'Generated test reproduces the issue', detail: 'Failed before the patch, passes after' },
  { label: 'Static re-analysis comes back clean', detail: 'The detector no longer fires' },
];

const CHAIN = [
  { kind: 'source', at: 'app/search.py:42' },
  { kind: 'transform', at: 'app/search.py:43' },
  { kind: 'sink', at: 'app/search.py:44' },
];

const FACTS = [
  {
    icon: FileCode2,
    label: 'Languages parsed',
    value: 'Python, JavaScript and TypeScript, by deterministic detectors',
  },
  {
    icon: Upload,
    label: 'Import paths',
    value: 'GitHub, GitLab, Git URLs, archive URLs and ZIP uploads',
  },
  {
    icon: Sparkles,
    label: 'Verdicts',
    value: 'Verified, probable or rejected, each with the evidence behind it',
  },
];
