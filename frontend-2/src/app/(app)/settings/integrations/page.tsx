'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Link2, Plug, Unplug } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion } from '@/components/ui/states';
import { useDisconnectProvider, useOAuthConnections, useOAuthProviders } from '@/hooks/use-platform';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { oauthService, toApiFailure } from '@/services/api';
import type { OAuthProviderName } from '@/types/api';

/**
 * Integrations.
 *
 * Provider connections are shown exactly as the backend reports them: whether the
 * OAuth app exists on the deployment, whether this account has authorised it, and
 * what the connection can do (sign in, import repositories). Nothing is offered
 * that is not configured, and disconnecting says what it keeps and what it drops.
 */
const ORDER: OAuthProviderName[] = ['github', 'gitlab', 'google'];

export default function IntegrationsSettingsPage() {
  const providers = useOAuthProviders();
  const connections = useOAuthConnections();
  const disconnect = useDisconnectProvider();
  const [pending, setPending] = React.useState<OAuthProviderName | null>(null);

  const connectionFor = (provider: OAuthProviderName) =>
    (connections.data ?? []).find((item) => item.provider === provider);

  return (
    <AppPage>
      <PageHeader
        title="Integrations"
        crumbs={[{ href: '/settings', label: 'Settings' }, { label: 'Integrations' }]}
        description="Source control providers this workspace can import from, and the connections authorised by this account."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/repositories/new">Import a repository</Link>
          </Button>
        }
      />

      {providers.isError ? (
        <ErrorState
          title="Could not read provider configuration"
          body="The provider endpoint did not answer. Git URL, archive URL and ZIP imports do not depend on it."
          onRetry={() => void providers.refetch()}
        />
      ) : null}

      {providers.isLoading ? <LoadingRegion label="Checking provider configuration" /> : null}

      {providers.data ? (
        <>
          <Callout tone="info" title="Two different things are being connected">
            Connecting a provider here authorises repository listing and import for your account.
            Signing in with a provider is a separate capability of the same OAuth app, and the API
            reports which of the two each connection supports.
          </Callout>

          <ul className="space-y-6">
            {ORDER.map((provider) => {
              const info = providers.data?.[provider];
              if (!info) return null;
              const connection = connectionFor(provider);
              const configured = info.configured;
              const connected = Boolean(connection);

              return (
                <li key={provider}>
                  <Panel>
                    <PanelHeader
                      title={info.display_name}
                      hint={
                        configured
                          ? 'OAuth app configured on this deployment.'
                          : 'No OAuth app configured on this deployment, so this provider cannot be connected here.'
                      }
                      icon={<Plug className="size-4" />}
                      actions={
                        connected ? (
                          <Badge tone="verified">
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Connected
                          </Badge>
                        ) : configured ? (
                          <Badge tone="neutral">Not connected</Badge>
                        ) : (
                          <Badge tone="medium">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            Unavailable
                          </Badge>
                        )
                      }
                    />

                    <div className="px-5 py-5 sm:px-6">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="chip">
                          {info.supports_repo_import ? 'Repository import' : 'No repository import'}
                        </span>
                        <span className="chip">
                          {info.supports_signin ? 'Sign-in' : 'No sign-in'}
                        </span>
                      </div>

                      {connected && connection ? (
                        <>
                          <DetailList className="mt-4 border-t border-hairline">
                            <DetailRow label="Authorised as">
                              {connection.provider_email ?? connection.provider_name ?? 'this account'}
                            </DetailRow>
                            <DetailRow label="Connected">
                              <span title={absoluteTime(connection.connected_at)}>
                                {relativeTime(connection.connected_at)}
                              </span>
                            </DetailRow>
                          </DetailList>

                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Button size="sm" variant="secondary" onClick={() => setPending(provider)}>
                              <Unplug className="size-3.5" aria-hidden="true" />
                              Disconnect
                            </Button>
                            {info.supports_repo_import ? (
                              <Button asChild size="sm" variant="ghost">
                                <Link href="/repositories/new">Import from {info.display_name}</Link>
                              </Button>
                            ) : null}
                          </div>
                        </>
                      ) : null}

                      {!connected && configured ? (
                        <div className="mt-4">
                          <a
                            href={oauthService.loginUrl(provider, '/settings/integrations')}
                            className="inline-flex items-center gap-2 rounded-md border border-hairline bg-chrome px-4 py-2.5 text-[13.5px] font-medium text-chrome-label transition-colors hover:bg-chrome-hover"
                          >
                            <Link2 className="size-4" aria-hidden="true" />
                            Connect {info.display_name}
                          </a>
                          <p className="mt-2.5 text-[12.5px] leading-relaxed text-muted">
                            You will be returned to this page after authorising.
                          </p>
                        </div>
                      ) : null}

                      {!configured ? (
                        <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-body">
                          This needs an OAuth application registered for {info.display_name} and its
                          client credentials set in the deployment’s server environment. Once that is
                          done, the connection appears here automatically. Until then, import the
                          repository by Git URL, archive URL or ZIP.
                        </p>
                      ) : null}
                    </div>
                  </Panel>
                </li>
              );
            })}
          </ul>

          {(connections.data ?? []).length === 0 ? (
            <EmptyState
              icon={<Plug className="size-4" aria-hidden="true" />}
              title="No provider connections yet"
              body="Connecting a provider lets the workspace list your repositories and import one without leaving the product. Nothing else about the account changes."
            />
          ) : null}
        </>
      ) : null}

      <Panel>
        <PanelHeader
          title="Other import paths"
          hint="Always available, with no provider configuration."
        />
        <div className="px-5 py-5 sm:px-6">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <li className="rounded-md border border-hairline bg-surface px-3.5 py-3">
              <p className="text-[13.5px] font-medium text-ink">Git URL</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-body">
                HTTPS clone at a branch of your choosing.
              </p>
            </li>
            <li className="rounded-md border border-hairline bg-surface px-3.5 py-3">
              <p className="text-[13.5px] font-medium text-ink">Archive URL</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-body">
                A direct ZIP link, validated at import time.
              </p>
            </li>
            <li className="rounded-md border border-hairline bg-surface px-3.5 py-3">
              <p className="text-[13.5px] font-medium text-ink">ZIP upload</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-body">
                For code the deployment cannot reach.
              </p>
            </li>
          </ul>
        </div>
      </Panel>

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Disconnect ${pending ? providers.data?.[pending]?.display_name : 'provider'}`}
        description="The stored provider token is deleted. Repositories already imported stay in the workspace and remain scannable; only new imports need the connection."
        confirmLabel="Disconnect"
        destructive
        pending={disconnect.isPending}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await disconnect.mutateAsync(pending);
            toast.success('Provider disconnected');
            setPending(null);
          } catch (error) {
            toast.error(toApiFailure(error).message);
          }
        }}
      />
    </AppPage>
  );
}
