'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, ErrorState, LoadingRegion } from '@/components/ui/states';
import { Table, TableFrame, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/context/auth-context';
import { useChangePassword, useRevokeAllSessions, useSecurityOverview } from '@/hooks/use-platform';
import { absoluteTime, relativeTime } from '@/lib/dates';
import { toApiFailure } from '@/services/api';

/**
 * Security.
 *
 * Password change, session revocation and the recent security events the backend
 * already records. Changing the password rotates the session token, so the new
 * one is adopted immediately: signing the person out here would be a surprise,
 * and leaving a stale token would break the next request.
 */
export default function SecuritySettingsPage() {
  const { user, rotateToken } = useAuth();
  const overview = useSecurityOverview();
  const changePassword = useChangePassword();
  const revokeSessions = useRevokeAllSessions();

  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [revokeOpen, setRevokeOpen] = React.useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mismatch || tooShort) return;
    try {
      const result = await changePassword.mutateAsync({ current, next });
      await rotateToken(result.access_token);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password changed. Other sessions are now invalid.');
    } catch (error) {
      toast.error(toApiFailure(error).message);
    }
  };

  return (
    <AppPage>
      <PageHeader
        title="Security"
        crumbs={[{ href: '/settings', label: 'Settings' }, { label: 'Security' }]}
        description="Password, active sessions and the security events recorded against this account."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/settings">Back to profile</Link>
          </Button>
        }
        meta={
          overview.data ? (
            <>
              <Badge tone={overview.data.email_verified ? 'verified' : 'medium'}>
                {overview.data.email_verified ? 'Email verified' : 'Email unverified'}
              </Badge>
              <span className="chip">Account {overview.data.account_status}</span>
              <span className="chip">MFA {overview.data.mfa_status.replace(/_/g, ' ')}</span>
            </>
          ) : undefined
        }
      />

      {overview.isError ? (
        <ErrorState
          title="Could not read the security overview"
          body="The security endpoint did not answer. Password change still works below."
          onRetry={() => void overview.refetch()}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Change password"
            hint="At least 8 characters. Every other session is invalidated when the password changes."
            icon={<KeyRound className="size-4" />}
          />
          <form onSubmit={submit} className="space-y-4 px-5 py-5 sm:px-6">
            <Field label="Current password" required>
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  required
                />
              )}
            </Field>
            <Field
              label="New password"
              hint="Eight characters or more."
              error={tooShort ? 'Use at least 8 characters.' : undefined}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  required
                  minLength={8}
                />
              )}
            </Field>
            <Field
              label="Confirm new password"
              error={mismatch ? 'The two passwords do not match.' : undefined}
              required
            >
              {(props) => (
                <Input
                  {...props}
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              )}
            </Field>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                loading={changePassword.isPending}
                disabled={!current || !next || mismatch || tooShort}
              >
                Change password
              </Button>
            </div>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Sessions"
              hint="Tokens are stateless, so revocation works by rotating the signing key for your account."
              icon={<LogOut className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <p className="max-w-[60ch] text-[13px] leading-relaxed text-body">
                Revoking all sessions signs out every device, including this one. You stay signed in
                here because the response returns a fresh token, which the workspace adopts straight
                away.
              </p>
              <div className="mt-4">
                <Button size="sm" variant="secondary" onClick={() => setRevokeOpen(true)}>
                  Revoke all sessions
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Session details"
              hint="What the API reports about this account right now."
              icon={<ShieldCheck className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              {overview.isLoading ? <LoadingRegion label="Loading security overview" /> : null}
              {overview.data ? (
                <DetailList className="border-t border-hairline">
                  <DetailRow label="Account">
                    <span className="font-mono text-[12px]">{user?.email}</span>
                  </DetailRow>
                  <DetailRow label="Status">{overview.data.account_status}</DetailRow>
                  <DetailRow label="Email">
                    {overview.data.email_verified ? 'Verified' : 'Unverified'}
                  </DetailRow>
                  <DetailRow label="MFA">
                    {overview.data.mfa_status.replace(/_/g, ' ')}
                  </DetailRow>
                </DetailList>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader
          title="Recent security events"
          hint="Sign-ins, password changes and revocation, as recorded by the API."
        />
        <div className="px-5 py-5 sm:px-6">
          {overview.isLoading ? <LoadingRegion label="Loading events" /> : null}

          {overview.data && overview.data.recent_events.length === 0 ? (
            <EmptyState
              title="No security events recorded"
              body="Events appear here as they happen, up to the number the endpoint returns."
            />
          ) : null}

          {overview.data && overview.data.recent_events.length > 0 ? (
            <TableFrame label="Recent security events">
              <Table minWidth="min-w-[640px]">
                <THead>
                  <TR>
                    <TH width="16rem">Event</TH>
                    <TH width="12rem">Address</TH>
                    <TH>Detail</TH>
                    <TH width="12rem" align="right">
                      When
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {overview.data.recent_events.map((event, index) => (
                    <TR key={`${event.event}-${event.at}-${index}`}>
                      <TD>
                        <span className="font-mono text-[12.5px] text-ink">
                          {event.event.replace(/_/g, ' ')}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-mono text-[12px] text-muted">{event.ip ?? 'not recorded'}</span>
                      </TD>
                      <TD>
                        {Object.keys(event.detail).length > 0 ? (
                          <span className="font-mono text-[11.5px] text-muted">
                            {Object.entries(event.detail)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(', ')}
                          </span>
                        ) : (
                          <span className="text-[12.5px] text-faint">None</span>
                        )}
                      </TD>
                      <TD align="right">
                        <span className="text-[12.5px] text-muted" title={absoluteTime(event.at)}>
                          {relativeTime(event.at)}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          ) : null}
        </div>
      </Panel>

      {overview.data && overview.data.mfa_status !== 'enabled' ? (
        <Callout tone="info" title="Two-factor authentication is not enabled">
          The API reports MFA as {overview.data.mfa_status.replace(/_/g, ' ')}. The product does not
          offer enrolment yet, so password strength and session hygiene are the controls available
          today.
        </Callout>
      ) : null}

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke every session"
        description="Every issued token for this account stops working. You stay signed in here with a fresh token."
        confirmLabel="Revoke all sessions"
        destructive
        pending={revokeSessions.isPending}
        onConfirm={async () => {
          try {
            const result = await revokeSessions.mutateAsync();
            await rotateToken(result.access_token);
            toast.success('All other sessions were revoked');
            setRevokeOpen(false);
          } catch (error) {
            toast.error(toApiFailure(error).message);
          }
        }}
      />
    </AppPage>
  );
}
