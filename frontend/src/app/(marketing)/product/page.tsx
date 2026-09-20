import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Boxes, FileSearch, GitCommitHorizontal, ScanSearch } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { PageHero, HeroFacts } from '@/components/marketing/page-hero';
import { ClosingCta, FactRow, TriageSurface, VerificationSurface } from '@/components/marketing/sections';
import { SampleFindingPreview, ProductFrame } from '@/components/marketing/product-frame';
import { Reveal } from '@/components/marketing/motion';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Platform overview',
  description:
    'What RepoVeriX reads, how a finding is built from an evidence chain, what the four scan configurations run, and what the product deliberately does not claim.',
  path: '/product',
  keywords: ['code analysis pipeline', 'evidence chain', 'static analysis and LLM', 'sandboxed verification'],
});

const STAGE_ROWS = [
  {
    stage: 'Ingestion',
    detail: 'Repository snapshot stored, languages detected, files indexed.',
    provider: 'No',
  },
  {
    stage: 'Parsing',
    detail: 'tree-sitter parse of Python, JavaScript and TypeScript with functions, calls and routes.',
    provider: 'No',
  },
  {
    stage: 'Static analysis',
    detail: 'Deterministic detectors for injection, shell execution, secrets, unsafe evaluation and weak hashing.',
    provider: 'No',
  },
  {
    stage: 'Model reasoning',
    detail: 'Candidate generation and context explanation on configurations that include it.',
    provider: 'Yes, on plans with reasoning',
  },
  {
    stage: 'Evidence validation',
    detail: 'Each claim must resolve to a source, a transformation and a sink, or it is downgraded.',
    provider: 'No',
  },
  {
    stage: 'Repair',
    detail: 'Candidate patch built against the snapshot, then checked for safe application.',
    provider: 'On plans with reasoning',
  },
  {
    stage: 'Verification',
    detail: 'Patch applied to a copy and executed in a sandbox; the outcome is recorded with exit codes.',
    provider: 'Needs container support',
  },
] as const;

const LIMITS = [
  {
    title: 'No CI integration or pull-request bot',
    body: 'Scans are started in the product today. Nothing is posted to your pull requests, and nothing fails a build yet.',
  },
  {
    title: 'No compliance certification',
    body: 'RepoVeriX reports what its stages found. It does not assert SOC 2, ISO 27001 or PCI status, and the interface never implies it.',
  },
  {
    title: 'Three languages, not every language',
    body: 'Python, JavaScript and TypeScript are parsed today. A file in another language can be stored but not analysed.',
  },
  {
    title: 'Findings are analysis output, not facts about your product',
    body: 'Every finding states its confidence and reachability, and validation can downgrade or reject a claim. An empty scan is not a clean bill of health.',
  },
] as const;

export default function ProductPage() {
  return (
    <>
      <PageHero
        title="From snapshot to verified repair"
        lead="Seven stages run in a fixed order. Each one records its own status and output, so you can always see which stage produced a claim and what it had to work with."
        actions={
          <>
            <Button asChild size="lg" variant="primary">
              <Link href="/auth/sign-up">
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs/concepts">Read the evidence model</Link>
            </Button>
          </>
        }
        aside={
          <HeroFacts
            facts={[
              { label: 'Reads', value: 'Python, JavaScript and TypeScript, with dependencies and git history' },
              { label: 'Records', value: 'Per-stage status, evidence chains, repair attempts and verification runs' },
              { label: 'Requires', value: 'Nothing for static-only scans; container support for verification' },
            ]}
          />
        }
      />

      <Section>
        <Shell width="wide">
          <SectionHeading
            title="Seven stages, each with its own record"
            lead="A scan is not one opaque job. Stages run in order, and the scan detail page lists every one with its status, timing and output."
          />
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-[13.5px]">
              <caption className="sr-only">Scan stages, what each does and whether it needs a model provider</caption>
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="py-2.5 pr-4 text-[12px] font-medium text-muted">
                    Stage
                  </th>
                  <th scope="col" className="py-2.5 pr-4 text-[12px] font-medium text-muted">
                    What it does
                  </th>
                  <th scope="col" className="py-2.5 text-[12px] font-medium text-muted">
                    Model provider
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {STAGE_ROWS.map((row) => (
                  <tr key={row.stage}>
                    <th scope="row" className="py-3.5 pr-4 align-top font-medium text-ink">
                      {row.stage}
                    </th>
                    <td className="py-3.5 pr-4 align-top text-body">{row.detail}</td>
                    <td className="py-3.5 align-top text-muted">{row.provider}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-muted">
            Static-only scans stop after parsing and static analysis. That is the configuration to use
            when the deployment has no provider keys at all.
          </p>
        </Shell>
      </Section>

      <TriageSurface />

      <Section bordered id="findings">
        <Shell width="wide">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
            <div>
              <SectionHeading
                title="A finding is a chain you can walk"
                lead="Severity is the least interesting part. What matters is whether the chain from untrusted input to sink holds together, and whether the route that reaches it is real."
              />
              <div className="mt-8">
                <FactRow
                  icon={FileSearch}
                  label="Claim"
                  value="One sentence stating what is wrong, in the function where it happens."
                />
                <FactRow
                  icon={GitCommitHorizontal}
                  label="Chain"
                  value="Source of input, transformation, and the sink it reaches, each with file and line evidence."
                />
                <FactRow
                  icon={Boxes}
                  label="Context"
                  value="The surrounding code, the rule that fired, and the repository, branch and commit it came from."
                />
                <FactRow
                  icon={ScanSearch}
                  label="Verdict"
                  value="Verified, probable or rejected, with the checks that decided it."
                />
              </div>
            </div>
            <Reveal className="min-w-0">
              <ProductFrame title="payments-api · finding detail" label="Sample finding">
                <SampleFindingPreview />
              </ProductFrame>
            </Reveal>
          </div>
        </Shell>
      </Section>

      <VerificationSurface />

      <Section>
        <Shell>
          <SectionHeading
            title="What this product does not do"
            lead="Limits are part of the specification. These are the ones that change how a team should use it."
          />
          <ul className="mt-10 divide-y divide-hairline border-y border-hairline">
            {LIMITS.map((limit) => (
              <li key={limit.title} className="py-5">
                <h3 className="text-[14.5px] font-medium text-ink">{limit.title}</h3>
                <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-relaxed text-body">{limit.body}</p>
              </li>
            ))}
          </ul>
        </Shell>
      </Section>

      <ClosingCta />
    </>
  );
}
