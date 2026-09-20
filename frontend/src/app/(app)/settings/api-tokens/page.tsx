'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Check, KeyRound, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion } from '@/components/ui/states';
import { Table, TableFrame, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from '@/hooks/use-platform';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { toApiFailure } from '@/services/api';

/**
 * API Tokens settings.
 *
 * Personal access tokens for CI/CD pipelines, automated scanners, and headless API access.
 * The raw token secret is displayed exactly once upon creation.
 */
export default function ApiTokensPage() {
  const tokens = useApiTokens();
  const createToken = useCreateApiToken();
  const revokeToken = useRevokeApiToken();

  const [name, setName] = React.useState('');
  const [createdToken, setCreatedToken] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [pendingRevokeId, setPendingRevokeId] = React.useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await createToken.mutateAsync(name.trim());
      setName('');
      setCreatedToken(res.token);
      toast.success('API token generated');
    } catch (error) {
      toast.error(toApiFailure(error).message);
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;
    await navigator.clipboard.writeText(createdToken);
    setCopied(true);
    toast.success('Token copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <AppPage>
      <PageHeader
        title="API Tokens"
        crumbs={[{ href: '/settings', label: 'Settings' }, { label: 'API Tokens' }]}
        description="Personal access tokens for CI/CD pipelines, headless integration, and CLI tools."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/settings">Back to profile</Link>
          </Button>
        }
      />

      {createdToken ? (
        <Callout
          tone="verified"
          title="New API Token Generated"
          action={
            <Button size="sm" variant="secondary" onClick={copyToken}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? 'Copied' : 'Copy token'}
            </Button>
          }
        >
          <p className="text-[13px] leading-relaxed">
            Make sure to copy your personal access token now. You won&apos;t be able to see it again!
          </p>
          <div className="mt-2 font-mono text-[13px] font-semibold text-ink bg-surface border border-hairline rounded px-3 py-2 select-all">
            {createdToken}
          </div>
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Create API Token"
            hint="Tokens carry your account permissions and can be revoked at any time."
            icon={<KeyRound className="size-4" />}
          />
          <form onSubmit={handleCreate} className="space-y-4 px-5 py-5 sm:px-6">
            <Field label="Token Description / Name" hint="e.g. GitHub Actions CI, Local CLI" required>
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CI / CD Pipeline"
                  required
                />
              )}
            </Field>
            <Button
              type="submit"
              variant="primary"
              loading={createToken.isPending}
              disabled={!name.trim()}
            >
              <Plus className="size-4" />
              Generate Token
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader
            title="Usage Information"
            hint="How to authenticate with API tokens."
          />
          <div className="space-y-3 px-5 py-5 sm:px-6 text-[13px] text-body leading-relaxed">
            <p>Pass your token in the <code className="font-mono text-[12px] bg-surface px-1.5 py-0.5 rounded">Authorization</code> header with bearer authentication:</p>
            <pre className="font-mono text-[12px] bg-surface border border-hairline p-3 rounded overflow-x-auto text-ink">
              Authorization: Bearer rvx_pat_...
            </pre>
            <p className="text-muted text-[12px]">
              Tokens never expire unless explicitly revoked or when account sessions are invalidated.
            </p>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Active Tokens"
          hint="Tokens that currently have access to your workspace."
        />
        <div className="px-5 py-5 sm:px-6">
          {tokens.isLoading ? <LoadingRegion label="Loading API tokens" /> : null}

          {tokens.isError ? (
            <ErrorState
              title="Could not load API tokens"
              body="The tokens endpoint did not answer."
              onRetry={() => void tokens.refetch()}
            />
          ) : null}

          {tokens.data && tokens.data.length === 0 ? (
            <EmptyState
              icon={<KeyRound className="size-4" aria-hidden="true" />}
              title="No API tokens created"
              body="Create a token above to authenticate CI/CD runners or local development scripts."
            />
          ) : null}

          {tokens.data && tokens.data.length > 0 ? (
            <TableFrame label="Active API Tokens">
              <Table minWidth="min-w-[640px]">
                <THead>
                  <TR>
                    <TH width="14rem">Name</TH>
                    <TH width="10rem">Prefix</TH>
                    <TH width="12rem">Last Used</TH>
                    <TH width="12rem">Created</TH>
                    <TH width="6rem" align="right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {tokens.data.map((token) => (
                    <TR key={token.id}>
                      <TD>
                        <span className="font-medium text-[13px] text-ink">{token.name}</span>
                      </TD>
                      <TD>
                        <span className="font-mono text-[12px] text-muted">
                          {token.token_prefix}...
                        </span>
                      </TD>
                      <TD>
                        {token.last_used_at ? (
                          <span className="text-[12.5px] text-muted" title={absoluteTime(token.last_used_at)}>
                            {relativeTime(token.last_used_at)}
                          </span>
                        ) : (
                          <Badge tone="neutral">Never</Badge>
                        )}
                      </TD>
                      <TD>
                        <span className="text-[12.5px] text-muted" title={absoluteTime(token.created_at)}>
                          {relativeTime(token.created_at)}
                        </span>
                      </TD>
                      <TD align="right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingRevokeId(token.id)}
                        >
                          <Trash2 className="size-3.5 text-critical" aria-hidden="true" />
                          Revoke
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          ) : null}
        </div>
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingRevokeId)}
        onOpenChange={(open) => !open && setPendingRevokeId(null)}
        title="Revoke API Token"
        description="Any automated system or CI pipeline using this token will immediately lose access. This action cannot be undone."
        confirmLabel="Revoke Token"
        destructive
        pending={revokeToken.isPending}
        onConfirm={async () => {
          if (!pendingRevokeId) return;
          try {
            await revokeToken.mutateAsync(pendingRevokeId);
            toast.success('Token revoked');
            setPendingRevokeId(null);
          } catch (error) {
            toast.error(toApiFailure(error).message);
          }
        }}
      />
    </AppPage>
  );
}
