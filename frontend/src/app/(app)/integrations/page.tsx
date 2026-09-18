'use client';

import Link from 'next/link';
import { Github, Gitlab, ScanSearch } from 'lucide-react';

import { SettingsConnections } from '@/components/settings-connections';
import { RvxLedger, RvxSurface } from '@/components/rvx/surface';
import { Button } from '@/components/ui/button';

const GUIDES = [
  {
    icon: Github,
    title: 'GitHub',
    body: 'Sign in and import private repositories. Existing imports stay after disconnect.',
    href: '/integrations/github',
  },
  {
    icon: Gitlab,
    title: 'GitLab',
    body: 'Analyze GitLab projects without changing the merge-request flow.',
    href: '/integrations/gitlab',
  },
  {
    icon: ScanSearch,
    title: 'CI / SARIF',
    body: 'Export findings and automate analysis from the tools catalog. Secrets stay in environment config.',
    href: '/tools',
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <header>
        <p className="rvx-eyebrow">Workspace connections</p>
        <h1 className="rvx-title mt-2 text-2xl sm:text-3xl">Integrations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Connect the providers this workspace can already use. Permissions and health come from the
          existing OAuth connection API — this page does not invent new credentials or scopes.
        </p>
      </header>

      <RvxSurface className="p-5">
        <h2 className="rvx-title text-base">Connected accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tokens are stored by the backend. The UI only shows connection state and disconnect actions.
        </p>
        <div className="mt-5">
          <SettingsConnections />
        </div>
      </RvxSurface>

      <section>
        <h2 className="rvx-eyebrow">Setup guides</h2>
        <RvxLedger className="mt-3">
          {GUIDES.map((guide) => {
            const Icon = guide.icon;
            return (
              <div
                key={guide.title}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 text-[hsl(var(--rvx-source))]" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{guide.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{guide.body}</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={guide.href}>Open guide</Link>
                </Button>
              </div>
            );
          })}
        </RvxLedger>
      </section>
    </div>
  );
}
