import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CircleSlash,
  Database,
  FileJson,
  FileText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import { Badge, SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { Reveal } from '@/components/marketing/motion';
import { HomeHero, TrustStrip } from '@/components/marketing/hero';
import { ShowcaseCard, ShowcaseRail } from '@/components/marketing/showcase';
import { WorkspaceScreenshot } from '@/components/marketing/app-frame';
import { ProductDemo } from '@/components/marketing/demo';
import { INTEGRATION_ROLES, IntegrationWall } from '@/components/marketing/integration-wall';
import {
  ClosingCta,
  FaqList,
  OutcomeGrid,
  TriageSurface,
  VerificationSurface,
} from '@/components/marketing/sections';
import { FAQS } from '@/lib/faqs';
import { SAMPLE_FINDINGS } from '@/lib/samples';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Repository security with evidence and verified repairs',
  description:
    'RepoVeriX scans a repository, grounds every finding in an evidence chain, and proves repairs by running them in an isolated sandbox. Static detectors work without a model provider.',
  path: '/',
  keywords: [
    'repository security',
    'code security scanning',
    'evidence chain',
    'static analysis',
    'verified fix',
    'SARIF',
  ],
});

/**
 * Home.
 *
 * The order follows the argument rather than a template: what it is, what the
 * interface looks like, what a finding has to answer, how triage works on it,
 * what verification proves, then how to start. Layout families alternate on
 * purpose (centred hero and collage, full-bleed rail, hanging bento, full-width
 * data surface, framed window, stepper, centred band) so no two consecutive
 * sections share a rhythm. Colour lives on the cards and panels; the page
 * background stays the warm canvas.
 */
export default function HomePage() {
  return (
    <>
      <HomeHero />
      <TrustStrip />

      {/* What the product looks like: the rail bleeds past the shell, so the
          first and last cards run off the edges the way a shelf does. */}
      <Section id="showcase" bordered>
        <Shell width="wide">
          <SectionHeading
            align="center"
            title="Look at the workspace before you read another word"
            lead="Five surfaces, in the order a reviewer meets them. Every picture below is the interface the product renders, with sample records."
          />
        </Shell>
        <ShowcaseRail label="Product surfaces" className="mt-10">
          <ShowcaseCard
            wash="cobalt"
            title="The claim and the chain that proves it"
            meta="Finding detail"
          >
            <ul className="divide-y divide-hairline">
              {[
                { kind: 'Source', detail: 'request.args.get("q")', at: 'app/search.py:42' },
                { kind: 'Transformation', detail: 'f-string interpolation', at: 'app/search.py:43' },
                { kind: 'Sink', detail: 'cursor.execute(query)', at: 'app/search.py:44' },
              ].map((step) => (
                <li key={step.kind} className="px-3.5 py-3">
                  <p className="text-[12.5px] font-medium text-ink">{step.kind}</p>
                  <p className="mt-0.5 break-words font-mono text-[11.5px] text-body">
                    {step.detail}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-faint">{step.at}</p>
                </li>
              ))}
            </ul>
          </ShowcaseCard>

          <ShowcaseCard wash="teal" title="Validation decides the verdict" meta="Verdicts">
            <ul className="divide-y divide-hairline">
              <li className="px-3.5 py-3">
                <Badge tone="verified">
                  <BadgeCheck className="size-3" aria-hidden="true" />
                  Verified
                </Badge>
                <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                  The claim is supported by evidence, and the reproduction confirmed it.
                </p>
              </li>
              <li className="px-3.5 py-3">
                <Badge tone="probable">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Probable
                </Badge>
                <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                  Evidence supports it, but execution could not confirm it: no test covers the path,
                  or a dependency was unavailable.
                </p>
              </li>
              <li className="px-3.5 py-3">
                <Badge tone="rejected">
                  <CircleSlash className="size-3" aria-hidden="true" />
                  Rejected
                </Badge>
                <p className="mt-2 text-[12.5px] leading-relaxed text-body">
                  Execution or a reachability check refuted it. The finding stays, with its
                  refutation.
                </p>
              </li>
            </ul>
          </ShowcaseCard>

          <ShowcaseCard
            wash="amber"
            title="Triage on severity and verdict together"
            meta="Findings list"
          >
            <ul className="divide-y divide-hairline">
              {SAMPLE_FINDINGS.map((finding) => (
                <li key={finding.rule} className="px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <SeverityBadge severity={finding.severity} compact />
                    <VerdictBadge status={finding.verdict} />
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-ink">
                    {finding.title}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-faint">
                    {finding.rule} · {finding.path}
                  </p>
                </li>
              ))}
            </ul>
          </ShowcaseCard>

          <ShowcaseCard wash="plum" title="Repository intelligence" meta="Structure and hotspots">
            <ul className="divide-y divide-hairline">
              {[
                { path: 'services/settlement.py', score: 41.2, issue: 'Long function, low cohesion' },
                { path: 'api/handlers.py', score: 52.7, issue: 'Repeated error handling' },
                { path: 'db/queries.py', score: 58.9, issue: 'Dynamic SQL construction' },
              ].map((file) => (
                <li key={file.path} className="px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[11.5px] text-ink">
                      {file.path}
                    </span>
                    <span data-numeric className="shrink-0 font-mono text-[11.5px] text-muted">
                      {file.score}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-body">{file.issue}</p>
                </li>
              ))}
              <li className="px-3.5 py-3">
                <p className="text-[12px] leading-relaxed text-muted">
                  Scores come from the file health pass, which runs alongside detection.
                </p>
              </li>
            </ul>
          </ShowcaseCard>

          <ShowcaseCard wash="slate" title="Exports that fit your pipeline" meta="Reporting">
            <ul className="divide-y divide-hairline">
              {[
                { icon: FileJson, name: 'SARIF 2.1.0', purpose: 'For code scanning dashboards' },
                { icon: FileText, name: 'Markdown', purpose: 'For a review or a ticket' },
                { icon: Database, name: 'JSON', purpose: 'The raw finding records' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name} className="flex items-start gap-3 px-3.5 py-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>
                      <span className="block font-mono text-[12px] text-ink">{item.name}</span>
                      <span className="mt-0.5 block text-[12px] text-body">{item.purpose}</span>
                    </span>
                  </li>
                );
              })}
              <li className="px-3.5 py-3">
                <p className="text-[12px] leading-relaxed text-muted">
                  Share links render the same report read-only, and revoke on demand.
                </p>
              </li>
            </ul>
          </ShowcaseCard>
        </ShowcaseRail>
      </Section>

      <OutcomeGrid />

      <TriageSurface />

      {/* The product at full size, in the dark theme it ships with. */}
      <Section bordered>
        <Shell width="wide">
          <SectionHeading
            align="center"
            title="The same interface, at full size"
            lead="This is the findings workspace with sample records: the real navigation, the real badges, the real code view, in the dark theme the product ships."
          />
          <Reveal className="mt-10">
            <WorkspaceScreenshot />
          </Reveal>
        </Shell>
      </Section>

      <Section>
        <Shell width="wide">
          <SectionHeading
            align="center"
            title="From import to verified repair"
            lead="Four steps. The panel advances on its own, and stops as soon as you interact with it."
          />
          <div className="mt-10">
            <ProductDemo />
          </div>
        </Shell>
      </Section>

      <VerificationSurface />

      <Section bordered>
        <Shell>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
            <div>
              <h2 className="text-[26px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[32px]">
                What it reads and imports today
              </h2>
              <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-body">
                Seven names, and what each one actually means here. Nothing on this page is a
                roadmap: if it is listed, the product does it now.
              </p>
              <ul className="mt-8 divide-y divide-hairline border-t border-hairline">
                {INTEGRATION_ROLES.map((item) => (
                  <li
                    key={item.name}
                    className="grid gap-1 py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-5"
                  >
                    <span className="text-[13.5px] font-medium text-ink">{item.name}</span>
                    <span className="text-[13px] leading-relaxed text-body">{item.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:pt-2">
              <IntegrationWall />
              <div className="mt-8 border-t border-hairline pt-5">
                <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  Sandboxed verification needs container support on the deployment. Where it is not
                  available, findings and evidence still work, and verification says it was not run.
                </p>
                <div className="mt-4">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/integrations">
                      Integration detail
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Shell>
      </Section>

      <Section>
        <Shell width="wide">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="text-[26px] font-semibold leading-[1.15] tracking-tight text-ink sm:text-[30px]">
                Questions engineers ask first
              </h2>
              <p className="mt-3 max-w-[40ch] text-[14px] leading-relaxed text-body">
                The rest, including what each plan limit covers, is in the documentation.
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Button asChild size="sm" variant="secondary">
                  <Link href="/docs/faq">Full FAQ</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/docs/getting-started">Setup guide</Link>
                </Button>
              </div>
            </div>
            <FaqList entries={FAQS.slice(0, 6)} />
          </div>
        </Shell>
      </Section>

      <ClosingCta />
    </>
  );
}
