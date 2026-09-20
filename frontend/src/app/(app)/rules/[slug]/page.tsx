'use client';

import * as React from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Search, ShieldCheck } from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, SeverityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeExcerpt } from '@/components/ui/code';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { CATEGORY_LABEL, CONFIDENCE_LABEL } from '@/lib/domain';
import { DETECTION_RULES, getRule } from '@/lib/rules';

/**
 * Rule detail.
 *
 * The rule catalogue ships with the frontend because the detectors do: it is the
 * engine's own explanation of what each id means, so a reader can decide whether
 * a finding's claim is plausible before reading any code.
 *
 * The page also shows which of this workspace's recorded findings carry the rule
 * id in their evidence metadata. That mapping is derived from evidence, not from
 * a rule column on the finding, because the API does not have one — so the count
 * here can legitimately be lower than the number of findings a reader might
 * expect to be "this rule".
 */
export default function RuleDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const rule = getRule(slug);

  if (!rule) {
    notFound();
  }

  return (
    <AppPage>
      <PageHeader
        crumbs={[
          { href: '/rules', label: 'Rules' },
          { label: rule.id },
        ]}
        title={rule.name}
        description={rule.summary}
        meta={
          <>
            <SeverityBadge severity={rule.severity} />
            <Badge tone="neutral">{CATEGORY_LABEL[rule.category] ?? rule.category}</Badge>
            <span className="chip">{rule.language === 'python' ? 'Python' : 'JavaScript'}</span>
            <span className="text-[12.5px] text-muted">
              Detector confidence {CONFIDENCE_LABEL(rule.confidence)}
            </span>
          </>
        }
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/rules">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All rules
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="How the detector decides"
              hint="The steps the engine takes, in order, before it emits this rule id."
              icon={<Search className="size-4" aria-hidden="true" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <ol className="space-y-3">
                {rule.howItWorks.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-strong text-[11px] font-medium text-muted">
                      {index + 1}
                    </span>
                    <p className="max-w-[78ch] text-[13.5px] leading-relaxed text-body">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Insecure and fixed"
              hint="The same pattern before and after the change the rule is asking for."
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <CodeExcerpt
                code={rule.example.insecure}
                label="Insecure"
                tone="critical"
                maxHeight="max-h-80"
              />
              <CodeExcerpt
                code={rule.example.secure}
                label="Fixed"
                tone="accent"
                maxHeight="max-h-80"
              />
              <p className="max-w-[78ch] text-[13px] leading-relaxed text-body">{rule.fix}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Where it misreads code"
              hint="The shapes this rule is known to flag wrongly. Read this before acting on a medium finding."
            />
            <div className="px-5 py-5 sm:px-6">
              <Callout tone="warning">
                <p className="text-[13px] leading-relaxed">{rule.falsePositives}</p>
              </Callout>
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel>
            <PanelHeader title="Rule record" titleAs="h2" />
            <div className="px-5 py-4 sm:px-6">
              <DetailList>
                <DetailRow label="Rule id">
                  <span className="font-mono text-[12.5px]">{rule.id}</span>
                </DetailRow>
                <DetailRow label="Category">
                  {CATEGORY_LABEL[rule.category] ?? rule.category}
                </DetailRow>
                <DetailRow label="Severity">{rule.severity}</DetailRow>
                <DetailRow label="Language">
                  {rule.language === 'python' ? 'Python' : 'JavaScript'}
                </DetailRow>
                <DetailRow label="Confidence">
                  <span className="font-mono text-[12.5px]">{rule.confidence.toFixed(2)}</span>
                </DetailRow>
              </DetailList>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Context the engine attaches"
              hint="Extra facts recorded on the evidence chain when this rule fires."
              icon={<BookOpen className="size-4" aria-hidden="true" />}
              titleAs="h2"
            />
            <div className="px-5 py-4 sm:px-6">
              <ul className="space-y-2">
                {rule.contextSignals.map((signal) => (
                  <li key={signal} className="text-[13px] leading-relaxed text-body">
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Finding this rule in your workspace"
              hint="Where a rule id is recorded, and where it is not."
              titleAs="h2"
            />
            <div className="space-y-3 px-5 py-4 sm:px-6">
              <p className="text-[13px] leading-relaxed text-muted">
                The detector stamps this id onto the first node of a finding&apos;s evidence chain.
                Findings have no rule column of their own, so the id appears on the finding page
                rather than as a filter here.
              </p>
              <p className="text-[13px] leading-relaxed text-muted">
                Findings from model-only configurations carry no detector rule at all, which is why
                a chain can legitimately show reasoning without an id.
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link href="/findings">Browse recorded findings</Link>
              </Button>
            </div>
          </Panel>
        </aside>
      </div>

      <p className="text-[12.5px] leading-relaxed text-muted">
        {DETECTION_RULES.length} rule{DETECTION_RULES.length === 1 ? '' : 's'} ship with this build.
        The catalogue is the engine&apos;s own; it is not configurable from the interface.
      </p>
    </AppPage>
  );
}
