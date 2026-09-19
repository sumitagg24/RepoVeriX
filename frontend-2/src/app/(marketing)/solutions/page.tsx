import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { PageHero, HeroFacts } from '@/components/marketing/page-hero';
import { ClosingCta, FaqList } from '@/components/marketing/sections';
import { FAQS } from '@/lib/faqs';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Solutions by role',
  description:
    'How a developer, a security lead and a platform team each read the same RepoVeriX output, and what to do first in each case.',
  path: '/solutions',
  keywords: ['application security workflow', 'security triage process', 'developer security tooling'],
});

const ROLES = [
  {
    id: 'developer',
    role: 'The developer who has to fix it',
    need: 'A finding that says what is wrong, where, and what to change, without leaving the file.',
    gets: 'Finding detail with the evidence chain, the surrounding lines, the rule that fired, a candidate patch, and the verification record when it exists.',
    first: 'Open one critical finding and read its chain before the code. If the path is not reachable, the finding says so.',
    link: { href: '/docs/concepts', label: 'How verdicts are decided' },
  },
  {
    id: 'security-lead',
    role: 'The security lead who has to triage and report',
    need: 'A list that can be filtered down to what needs a decision, and output that other tools accept.',
    gets: 'Findings filtered by severity, repository, rule, category, verdict and status; verdicts that stay visible when a claim is rejected; SARIF, Markdown and JSON exports; an organization dashboard and security center.',
    first: 'Filter to verified critical and high findings, then check reachability before assigning work.',
    link: { href: '/docs/api', label: 'Export formats and endpoints' },
  },
  {
    id: 'platform',
    role: 'The platform team rolling it out',
    need: 'To know what the deployment needs, what each plan allows, and who can see what.',
    gets: 'Repository inventory with connection state, per-plan limits on repositories and scans, roles on organizations, and an integrations screen that reports provider state instead of hiding it.',
    first: 'Run a static-only scan first: it needs no provider key, so it proves the deployment works before any key is added.',
    link: { href: '/pricing', label: 'Compare plan limits' },
  },
] as const;

const START_STEPS = [
  {
    title: 'Point it at one repository',
    body: 'Import through a provider, a Git URL, an archive URL or a ZIP upload. The snapshot is stored by RepoVeriX and your working copy is untouched.',
  },
  {
    title: 'Run a static-only scan first',
    body: 'It runs the deterministic detectors with no model provider, so it validates the deployment and the repository in one pass.',
  },
  {
    title: 'Read one finding end to end',
    body: 'Claim, chain, context, verdict. That single read tells you whether the output is worth wiring into a team process.',
  },
] as const;

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        title="The same output, read three different ways"
        lead="A developer needs a change they trust. A security lead needs a queue they can defend. A platform team needs to know the deployment works and who can see what."
        actions={
          <>
            <Button asChild size="lg" variant="primary">
              <Link href="/auth/sign-up">
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs/getting-started">Read the setup guide</Link>
            </Button>
          </>
        }
        aside={
          <HeroFacts
            facts={[
              { label: 'Plans', value: 'Limits on repositories, scans, repairs and verifications per month' },
              { label: 'Roles', value: 'Member, admin and owner on organizations' },
              { label: 'Nothing hidden', value: 'Rejected claims stay in the list on every plan' },
            ]}
          />
        }
      />

      <Section>
        <Shell width="wide">
          <div className="divide-y divide-hairline border-y border-hairline">
            {ROLES.map((role) => (
              <article key={role.id} id={role.id} className="grid grid-cols-1 gap-6 py-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
                <div>
                  <h2 className="text-[20px] font-semibold leading-snug tracking-tight text-ink">{role.role}</h2>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{role.need}</p>
                </div>
                <div className="space-y-4">
                  <p className="max-w-[68ch] text-[14.5px] leading-relaxed text-body">{role.gets}</p>
                  <div className="rounded-md border border-accent-line bg-accent-soft px-3.5 py-3">
                    <p className="text-[13px] font-medium text-accent">Start here</p>
                    <p className="mt-1 max-w-[68ch] text-[13.5px] leading-relaxed text-body">{role.first}</p>
                  </div>
                  <Link
                    href={role.link.href}
                    className="inline-flex items-center gap-1.5 text-[13.5px] text-accent underline-offset-4 hover:underline"
                  >
                    {role.link.label}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </Shell>
      </Section>

      <Section muted bordered>
        <Shell>
          <SectionHeading
            title="How a team usually starts"
            lead="Three steps, in this order, because each one answers a question the next step depends on."
          />
          <ol className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            {START_STEPS.map((step, index) => (
              <li key={step.title} className="border-t border-hairline pt-5">
                <span className="font-mono text-[12px] text-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-2 text-[15px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-body">{step.body}</p>
              </li>
            ))}
          </ol>
        </Shell>
      </Section>

      <Section>
        <Shell>
          <SectionHeading title="Questions that come up before adoption" />
          <FaqList className="mt-8" entries={[FAQS[0], FAQS[1], FAQS[6], FAQS[8]]} />
        </Shell>
      </Section>

      <ClosingCta
        title="Try it against one repository before you decide anything"
        body="Static-only scans need no provider key, so the first result costs nothing but a repository import."
      />
    </>
  );
}
