'use client';

import * as React from 'react';
import { Check, GitBranch, PlayCircle, ScanSearch, ShieldCheck, Wrench } from 'lucide-react';

import { Badge, SeverityBadge, VerdictBadge } from '@/components/ui/badge';
import { DiffView } from '@/components/ui/code';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { ProductFrame, SampleFindingPreview, SamplePipeline, SampleRepositoryRow } from '@/components/marketing/product-frame';
import { cn } from '@/lib/utils';

/**
 * Workflow.
 *
 * A guided stepper rather than five identical feature blocks. Each step shows the
 * surface the product actually renders at that point, and the scan configurations
 * listed are the four the API accepts, including the two that are comparisons
 * rather than tiers.
 */
const STEPS = [
  { id: 'connect', label: 'Connect a repository', icon: GitBranch },
  { id: 'scan', label: 'Run a scan', icon: ScanSearch },
  { id: 'read', label: 'Read the finding', icon: PlayCircle },
  { id: 'repair', label: 'Review the repair', icon: Wrench },
  { id: 'verify', label: 'Verify the fix', icon: ShieldCheck },
] as const;

const CONFIGURATIONS = [
  {
    name: 'RepoVeriX',
    detail: 'Static detectors, model reasoning, evidence validation and verification.',
  },
  { name: 'Static and model', detail: 'Adds reasoning to the deterministic detectors, without validation.' },
  { name: 'Static only', detail: 'Deterministic analysis with no provider key at all.' },
  { name: 'Model only', detail: 'A comparison baseline that shows what reasoning adds on its own.' },
] as const;

const REMEDIATION_CHECKS = [
  { label: 'Patch applies cleanly to the snapshot' },
  { label: 'Interpolated query replaced with a parameterised call' },
  { label: 'Call sites and argument order unchanged' },
  { label: 'Existing tests for the module still pass' },
] as const;

export function WorkflowStepper() {
  return (
    <Section id="workflow">
      <Shell width="wide">
        <SectionHeading
          eyebrow="How it works"
          title="From repository to verified repair"
          lead="Five steps, in the order they happen in the product. Each panel below is the surface you would be looking at."
        />

        <Tabs defaultValue="connect" className="mt-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
            {/* Mobile: scroll-snap pills. Desktop: a vertical stepper. */}
            <div className="lg:pt-1">
              <TabsList
                label="Workflow steps"
                className="no-scrollbar flex-nowrap gap-1.5 overflow-x-auto border-b-0 pb-1 sm:flex-wrap lg:flex-col lg:items-stretch lg:gap-1"
              >
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <TabsTrigger
                      key={step.id}
                      value={step.id}
                      className={cn(
                        'shrink-0 justify-start gap-2.5 rounded-md border border-hairline px-3 py-2 text-left data-[state=active]:border-hairline-strong data-[state=active]:bg-surface',
                        'lg:border-transparent lg:px-3 lg:py-2.5 lg:data-[state=active]:border-transparent',
                      )}
                    >
                      <span className="font-mono text-[11px] text-faint">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span className="whitespace-nowrap text-[13.5px]">{step.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="min-w-0">
              <TabsContent value="connect">
                <div className="space-y-6">
                  <StepCopy
                    title="Import once, then scan as often as you like"
                    body="A repository records where the source came from and which branch is pinned. The snapshot is stored by RepoVeriX; your working copy is never modified."
                  />
                  <ProductFrame title="Connected repositories" label="Sample row">
                    <SampleRepositoryRow />
                  </ProductFrame>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {['GitHub OAuth', 'GitLab OAuth', 'Any Git URL', 'Archive URL or ZIP upload'].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-[13.5px] text-body">
                        <Check className="size-3.5 shrink-0 text-verified" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="scan">
                <div className="space-y-6">
                  <StepCopy
                    title="Four configurations, stated plainly"
                    body="The configurations are not tiers. They exist so a team can see what deterministic analysis finds alone, what reasoning adds, and what evidence validation removes."
                  />
                  <ul className="divide-y divide-hairline border-y border-hairline">
                    {CONFIGURATIONS.map((configuration) => (
                      <li key={configuration.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
                        <span className="text-[13.5px] font-medium text-ink">{configuration.name}</span>
                        <span className="text-[13px] text-body">{configuration.detail}</span>
                      </li>
                    ))}
                  </ul>
                  <ProductFrame title="Scan pipeline" label="Stage order">
                    <div className="px-4 py-4 sm:px-5">
                      <SamplePipeline />
                    </div>
                  </ProductFrame>
                </div>
              </TabsContent>

              <TabsContent value="read">
                <div className="space-y-6">
                  <StepCopy
                    title="The claim first, then the chain behind it"
                    body="A finding opens with what is wrong in one sentence, then the source, the transformation and the sink, then the file and lines. Context before code, always."
                  />
                  <ProductFrame title="payments-api · finding detail" label="Sample finding">
                    <SampleFindingPreview />
                  </ProductFrame>
                </div>
              </TabsContent>

              <TabsContent value="repair">
                <div className="space-y-6">
                  <StepCopy
                    title="A candidate repair with its reasoning attached"
                    body="The repair is a patch against the snapshot, checked for the properties that make it safe to apply before it is ever executed."
                  />
                  <ProductFrame title="Candidate patch" label="Sample patch">
                    <div className="space-y-4 px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity="critical" />
                        <Badge tone="accent">Candidate fix</Badge>
                        <span className="chip font-mono">RVX-SQLI-001</span>
                      </div>
                      <DiffView
                        label="app/search.py"
                        diff={`@@ -41,4 +41,4 @@
 def search_users(request):
     term = request.args.get("q")
-    query = f"SELECT * FROM users WHERE name = '{term}'"
-    cursor.execute(query)
+    query = "SELECT * FROM users WHERE name = %s"
+    cursor.execute(query, (term,))`}
                      />
                      <ul className="space-y-2">
                        {REMEDIATION_CHECKS.map((check) => (
                          <li key={check.label} className="flex items-start gap-2.5 text-[13px] text-body">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-verified" aria-hidden="true" />
                            {check.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ProductFrame>
                </div>
              </TabsContent>

              <TabsContent value="verify">
                <div className="space-y-6">
                  <StepCopy
                    title="Execution is the evidence"
                    body="The patch is applied to a copy, dependencies resolve, the recorded checks run, and the outcome is written to the verification record with its exit codes."
                  />
                  <ProductFrame title="Verification record" label="Sample run">
                    <div className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <VerdictBadge status="verified" />
                        <span className="chip">Run completed</span>
                      </div>
                      <DetailList className="mt-4 border-t border-hairline">
                        <DetailRow label="Patch applied">Clean, no conflicts</DetailRow>
                        <DetailRow label="Dependencies">Resolved from the lockfile</DetailRow>
                        <DetailRow label="Checks executed">
                          <span data-numeric className="font-mono text-[12px]">
                            4 of 4
                          </span>
                        </DetailRow>
                        <DetailRow label="Exit codes">
                          <span className="font-mono text-[12px]">0, 0, 0, 0</span>
                        </DetailRow>
                        <DetailRow label="Wall clock">
                          <span data-numeric className="font-mono text-[12px]">
                            18.4s
                          </span>
                        </DetailRow>
                      </DetailList>
                      <p className="mt-4 text-[12.5px] leading-relaxed text-faint">
                        Verification requires container support and a plan that includes it. When it is
                        not available, findings keep their evidence and stay marked probable.
                      </p>
                    </div>
                  </ProductFrame>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </Shell>
    </Section>
  );
}

function StepCopy({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-[18px] font-semibold leading-snug tracking-tight text-ink">{title}</h3>
      <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-body">{body}</p>
    </div>
  );
}
