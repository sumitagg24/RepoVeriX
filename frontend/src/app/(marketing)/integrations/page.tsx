import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shell, Section, SectionHeading } from '@/components/layout/shell';
import { PageHero, HeroFacts } from '@/components/marketing/page-hero';
import { ClosingCta } from '@/components/marketing/sections';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Integrations',
  description:
    'Every way RepoVeriX can read a repository today, what each path requires, and how connection problems are reported in the workspace.',
  path: '/integrations',
  keywords: ['github integration', 'gitlab integration', 'repository import', 'zip upload scan'],
});

const PATHS = [
  {
    name: 'GitHub',
    kind: 'OAuth',
    detail:
      'Connect an account, list the repositories your account can read, and import one without leaving the workspace.',
    requires: 'An OAuth application registered on the deployment, with its client id and secret configured.',
    states: ['Connected', 'Re-authorization needed after a password or scope change', 'Not configured on this deployment'],
  },
  {
    name: 'GitLab',
    kind: 'OAuth',
    detail: 'The same connect and import flow for repositories hosted on GitLab.',
    requires: 'A GitLab OAuth application registered on the deployment.',
    states: ['Connected', 'Re-authorization needed', 'Not configured on this deployment'],
  },
  {
    name: 'Git URL',
    kind: 'Direct',
    detail: 'Clone a repository over HTTPS, pin the branch, and scan that snapshot.',
    requires: 'Network reachability from the deployment to the Git host. Private hosts need credentials in the URL.',
    states: ['Registered and scannable', 'Clone failed, with the reason recorded on the scan'],
  },
  {
    name: 'Archive URL',
    kind: 'Direct',
    detail: 'Point at a direct ZIP: an S3 object, a release asset, or a presigned URL that expires.',
    requires: 'A URL the deployment can fetch. The payload is validated as a ZIP when the scan runs.',
    states: ['Registered and scannable', 'Download failed or payload rejected, with the reason on the scan'],
  },
  {
    name: 'ZIP upload',
    kind: 'Upload',
    detail: 'Upload an archive when the code cannot be reached from the deployment at all.',
    requires: 'A ZIP under the deployment upload limit. Content is sniffed for ZIP magic bytes, never trusted by extension.',
    states: ['Stored and scannable', 'Upload rejected for size or invalid content'],
  },
] as const;

export default function IntegrationsPage() {
  return (
    <>
      <PageHero
        title="Five paths in, each with its requirements stated"
        lead="Integrations are listed with what they need before you click anything. Provider connections that are not configured on a deployment say so instead of failing silently."
        actions={
          <>
            <Button asChild size="lg" variant="primary">
              <Link href="/auth/sign-up">
                Start free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/docs/getting-started">Setup guide</Link>
            </Button>
          </>
        }
        aside={
          <HeroFacts
            facts={[
              { label: 'Today', value: 'Source control connections, direct Git, archives and ZIP uploads' },
              { label: 'States', value: 'Connected, re-authorization needed, or not configured on this deployment' },
              { label: 'Not built', value: 'Issue trackers, chat notifications and CI hooks are not part of the product' },
            ]}
          />
        }
      />

      <Section>
        <Shell width="wide">
          <ul className="divide-y divide-hairline border-y border-hairline">
            {PATHS.map((path) => (
              <li key={path.name} className="grid grid-cols-1 gap-4 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[17px] font-semibold text-ink">{path.name}</h2>
                    <Badge tone="neutral">{path.kind}</Badge>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{path.requires}</p>
                </div>
                <div>
                  <p className="max-w-[68ch] text-[14px] leading-relaxed text-body">{path.detail}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {path.states.map((state) => (
                      <li key={state} className="chip">
                        {state}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </Shell>
      </Section>

      <Section bordered muted>
        <Shell>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <SectionHeading
                title="When a connection breaks"
                lead="Connection problems are recorded, not hidden. The integrations screen shows the state and the action that clears it."
              />
              <ul className="mt-8 space-y-3">
                {[
                  'A revoked or expired token marks the connection as needing re-authorization, and imports stop until it is reconnected.',
                  'A failed clone or download is recorded on the scan itself, with the reason, so a retry is a decision rather than a guess.',
                  'An unconfigured provider is reported as unconfigured on the deployment, which is a setup task, not a product bug.',
                ].map((line) => (
                  <li key={line} className="max-w-[68ch] text-[13.5px] leading-relaxed text-body">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionHeading
                title="Scope of what is read"
                lead="Connections request read access to repository contents. Nothing is written back to your provider."
              />
              <dl className="mt-8 divide-y divide-hairline border-t border-hairline">
                {[
                  { label: 'Requested', value: 'Read access to the repositories you choose to import' },
                  { label: 'Written back', value: 'Nothing. No commits, no branches, no pull requests' },
                  { label: 'Stored', value: 'The snapshot RepoVeriX scans, plus the analysis it produced' },
                  { label: 'Removed', value: 'Deleting a repository removes the stored snapshot and its analysis' },
                ].map((row) => (
                  <div key={row.label} className="grid gap-1 py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-[13px] text-muted">{row.label}</dt>
                    <dd className="text-[13.5px] text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Shell>
      </Section>

      <ClosingCta
        title="Import one repository and see the state reporting for yourself"
        body="Connect a provider, or skip it entirely and scan a Git URL or an uploaded archive."
      />
    </>
  );
}
