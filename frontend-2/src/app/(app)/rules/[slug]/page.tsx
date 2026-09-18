import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, Filter, Info, Wrench } from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SeverityBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeExcerpt } from '@/components/ui/code';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { getRule } from '@/lib/rules';
import { CATEGORY_LABEL, CONFIDENCE_LABEL } from '@/lib/domain';

/**
 * Rule detail.
 *
 * A reference page rather than a dashboard: the detector's own description, the
 * signals it attaches to the evidence chain, where it is known to be noisy, and
 * a fix written as code. The false-positive note is not optional politeness; it
 * is the part of a rule page that stops a reviewer from treating a match as
 * proof.
 */
export default async function RuleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rule = getRule(slug);
  if (!rule) notFound();

  return (
    <AppPage>
      <PageHeader
        title={rule.name}
        crumbs={[
          { href: '/rules', label: 'Rules' },
          { label: rule.id },
        ]}
        description={rule.summary}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/rules">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All rules
            </Link>
          </Button>
        }
        meta={
          <>
            <SeverityBadge severity={rule.severity} />
            <span className="chip font-mono">{rule.id}</span>
            <span className="chip">{rule.language === 'python' ? 'Python' : 'JavaScript'}</span>
            <span className="chip">{CATEGORY_LABEL[rule.category] ?? rule.category}</span>
            <span className="text-[12px] text-muted">
              {CONFIDENCE_LABEL(rule.confidence)} when it fires
            </span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="How the detector decides"
              hint="In the detector's own terms, in the order it checks."
              icon={<BookOpen className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <ol className="space-y-3">
                {rule.howItWorks.map((step, index) => (
                  <li key={step} className="flex gap-3.5">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-hairline bg-surface font-mono text-[11.5px] text-muted">
                      {index + 1}
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-body">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Examples"
              hint="The insecure shape that matches, and the repair that does not."
            />
            <div className="space-y-4 px-5 py-5 sm:px-6">
              <CodeExcerpt
                code={rule.example.insecure}
                label="Matches this"
                tone="critical"
                maxHeight="max-h-56"
              />
              <CodeExcerpt
                code={rule.example.secure}
                label="Does not match"
                tone="accent"
                maxHeight="max-h-56"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Where it is noisy"
              hint="Why a match is a claim to review rather than a confirmed defect."
              icon={<Info className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-body">
                {rule.falsePositives}
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Fix direction"
              hint="What to change, not just what is wrong."
              icon={<Wrench className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <p className="max-w-[80ch] text-[13.5px] leading-relaxed text-body">{rule.fix}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Context the engine attaches"
              hint="Signals that appear in the evidence chain when this rule fires."
            />
            <div className="px-5 py-5 sm:px-6">
              <ul className="space-y-2.5">
                {rule.contextSignals.map((signal) => (
                  <li key={signal} className="rounded-md border border-hairline bg-surface px-3 py-2">
                    <span className="break-words font-mono text-[11.5px] text-body">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Find this rule in your workspace" hint="The findings list searches rule ids." />
            <div className="px-5 py-5 sm:px-6">
              <Button asChild size="sm" variant="secondary">
                <Link href={`/findings?q=${encodeURIComponent(rule.id)}`}>
                  <Filter className="size-3.5" aria-hidden="true" />
                  Findings with {rule.id}
                </Link>
              </Button>
            </div>
          </Panel>

          <Callout tone="info" title="Severity here is the rule default">
            A finding’s recorded severity can differ: the engine raises severity when the value
            traces back to an entry point, and a validation pass can change the verdict without
            changing the rule.
          </Callout>
        </div>
      </div>
    </AppPage>
  );
}
