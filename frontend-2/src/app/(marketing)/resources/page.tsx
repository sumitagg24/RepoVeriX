import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { PageHero, HeroFacts } from '@/components/marketing/page-hero';
import { ClosingCta } from '@/components/marketing/sections';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Resources',
  description:
    'Guides for importing a repository, running a first scan and reading a finding, plus how RepoVeriX records and evaluates its own output.',
  path: '/resources',
  keywords: ['security analysis guide', 'scan a repository', 'read a security finding'],
});

const GUIDES = [
  {
    href: '/docs/getting-started',
    title: 'Import, scan, read',
    body: 'The first hour: how to get a repository in, which configuration to choose and what the first finding page shows.',
    reading: '6 min read',
  },
  {
    href: '/docs/concepts',
    title: 'Evidence model and verdicts',
    body: 'What belongs in an evidence chain, why reachability is recorded separately from severity, and how verified, probable and rejected are decided.',
    reading: '8 min read',
  },
  {
    href: '/docs/api',
    title: 'API reference',
    body: 'Every endpoint this interface calls, with the plan gates, rate limits and export formats that apply to them.',
    reading: '5 min read',
  },
  {
    href: '/rules',
    title: 'Detection rules',
    body: 'The shipped rule IDs and the pattern each detector looks for, with the languages it applies to.',
    reading: '4 min read',
  },
] as const;

const EVALUATION = [
  {
    title: 'Per-stage records',
    body: 'Every scan stores each stage with its own status, timing and output. You can see whether a finding came from a detector, from reasoning, or from validation.',
  },
  {
    title: 'Confidence is stored, not implied',
    body: 'Findings keep the confidence their stage produced, and validation can downgrade a claim. Nothing is upgraded to sound more certain than it is.',
  },
  {
    title: 'Comparable configurations',
    body: 'The same repository can be scanned static-only, model-only, static plus model, and through the full pipeline, then compared.',
  },
  {
    title: 'Refutations are kept',
    body: 'A rejected finding stays visible with the checks that contradicted it, which is what makes the list auditable rather than just shorter.',
  },
] as const;

export default function ResourcesPage() {
  return (
    <>
      <PageHero
        title="Documentation, in the order people need it"
        lead="Four entry points cover the first week: getting a repository in, understanding what a finding contains, calling the API, and checking what each detection rule looks for."
        actions={
          <>
            <Button asChild size="lg" variant="primary">
              <Link href="/docs/getting-started">
                Read getting started
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs/faq">Browse the FAQ</Link>
            </Button>
          </>
        }
        aside={
          <HeroFacts
            facts={[
              { label: 'Public by design', value: 'The workspace links to these same pages' },
              { label: 'No gated handbook', value: 'Nothing important is behind a sales conversation' },
              { label: 'Support today', value: 'Documentation and the product itself; there is no ticketing integration' },
            ]}
          />
        }
      />

      <Section>
        <Shell width="wide">
          <ul className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <li key={guide.href} className="border-t border-hairline pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={guide.href}
                    className="text-[17px] font-semibold text-ink transition-colors hover:text-accent"
                  >
                    {guide.title}
                  </Link>
                  <span className="text-[12px] text-faint">{guide.reading}</span>
                </div>
                <p className="mt-2 max-w-[58ch] text-[13.5px] leading-relaxed text-body">{guide.body}</p>
              </li>
            ))}
          </ul>
        </Shell>
      </Section>

      <Section bordered muted id="research">
        <Shell>
          <SectionHeading
            title="How the output is evaluated"
            lead="The product is built so its own claims can be checked. Four decisions make that possible, and they are visible in the interface rather than in a report."
          />
          <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {EVALUATION.map((item) => (
              <div key={item.title} className="border-t border-hairline pt-5">
                <h3 className="text-[15px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-body">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[70ch] text-[13px] leading-relaxed text-muted">
            No benchmark numbers are published here. Detection and verification quality depends on the
            repository, the language mix and the checks that exist, and the product states what it ran
            rather than a percentage that would not transfer to your code.
          </p>
        </Shell>
      </Section>

      <ClosingCta />
    </>
  );
}
