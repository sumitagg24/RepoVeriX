import * as React from 'react';

import { Shell } from '@/components/layout/shell';
import { Reveal } from '@/components/marketing/motion';

/**
 * Interior page hero.
 *
 * Left aligned, hairline bottom, optional aside for facts or a next step. The
 * home page has the only split hero in the site; every other page opens with this
 * band so the composition does not repeat itself across routes.
 */
export function PageHero({
  title,
  lead,
  actions,
  aside,
}: {
  title: string;
  lead: string;
  actions?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-hairline">
      <div className="grid-texture" aria-hidden="true" />
      <Shell width="wide" className="relative py-14 sm:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
          <Reveal>
            <h1 className="max-w-[26ch] text-[30px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[42px]">
              {title}
            </h1>
            <p className="mt-4 max-w-[62ch] text-[15.5px] leading-relaxed text-body">{lead}</p>
            {actions ? <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div> : null}
          </Reveal>
          {aside ? (
            <Reveal delay={0.08} className="lg:pt-2">
              {aside}
            </Reveal>
          ) : null}
        </div>
      </Shell>
    </section>
  );
}

/** Compact fact list used in the page-hero aside slot. */
export function HeroFacts({ facts }: { facts: readonly { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-hairline border-y border-hairline">
      {facts.map((fact) => (
        <div key={fact.label} className="py-3">
          <dt className="text-[12px] font-medium text-muted">{fact.label}</dt>
          <dd className="mt-1 text-[13.5px] leading-relaxed text-ink">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
