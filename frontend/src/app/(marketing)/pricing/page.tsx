import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { PageHero, HeroFacts } from '@/components/marketing/page-hero';
import { ClosingCta, FaqList } from '@/components/marketing/sections';
import { PricingPlans } from '@/components/marketing/pricing';
import { FAQS } from '@/lib/faqs';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Pricing',
  description:
    'RepoVeriX plans: repository, scan, repair and verification limits per month, with model reasoning and sandboxed verification included from Pro.',
  path: '/pricing',
  keywords: ['repository security pricing', 'code security plans', 'security tool per repository'],
});

const LIMIT_BEHAVIOUR = [
  {
    title: 'The action is refused with a reason',
    body: 'The API answers with the specific limit that was hit, and the interface names it on the screen you were using instead of a generic failure.',
  },
  {
    title: 'Nothing existing is removed',
    body: 'Repositories, scans, findings and verification records already stored stay exactly as they are when a plan lapses or a limit is reached.',
  },
  {
    title: 'Static analysis keeps working',
    body: 'Deterministic detectors need no provider key, so the free plan remains a usable analysis tool rather than a trial.',
  },
  {
    title: 'Upgrades take effect immediately',
    body: 'Checkout runs through the API. The billing screen reflects the new limits as soon as the subscription state changes.',
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <PageHero
        title="Plans that change scope, never certainty"
        lead="Every plan produces findings with the same evidence model, the same confidence records and the same visible rejected claims. Plans move how much you can point the product at, and whether reasoning and verification run."
        actions={
          <>
            <Button asChild size="lg" variant="primary">
              <Link href="/auth/sign-up">
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs/api">Read the API reference</Link>
            </Button>
          </>
        }
        aside={
          <HeroFacts
            facts={[
              { label: 'Free', value: '$0 · 3 repositories · 5 scans a month · static analysis only' },
              { label: 'Pro', value: '$29 a month · 20 repositories · 60 scans · reasoning and verification' },
              { label: 'Team', value: '$99 a month · 100 repositories · 400 scans · 5 collaborators' },
            ]}
          />
        }
      />

      <Section>
        <Shell width="wide">
          <PricingPlans />
        </Shell>
      </Section>

      <Section muted bordered>
        <Shell>
          <SectionHeading
            title="What reaching a limit actually looks like"
            lead="Plan gates are part of the interface, not an error page. Here is exactly what happens at the boundary."
          />
          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
            {LIMIT_BEHAVIOUR.map((item) => (
              <div key={item.title} className="border-t border-hairline pt-5">
                <h3 className="text-[15px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-body">{item.body}</p>
              </div>
            ))}
          </div>
        </Shell>
      </Section>

      <Section>
        <Shell>
          <SectionHeading title="Pricing questions" />
          <FaqList className="mt-8" entries={[FAQS[6], FAQS[7], FAQS[5], FAQS[4]]} />
        </Shell>
      </Section>

      <ClosingCta
        title="Start on the free plan and decide later"
        body="Three repositories and five scans a month, with the full evidence model and no card required."
      />
    </>
  );
}
