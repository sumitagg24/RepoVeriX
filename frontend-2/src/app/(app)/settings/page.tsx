'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, MailWarning, ShieldAlert, UserRound } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge, PlanBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { DetailList, DetailRow } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { Avatar } from '@/components/ui/misc';
import { LoadingRegion } from '@/components/ui/states';
import { useAuth } from '@/context/auth-context';
import { absoluteDate } from '@/lib/dates';
import { authService, toApiFailure } from '@/services/api';

/**
 * Profile.
 *
 * The account surface the backend actually exposes: display name, email
 * verification, plan, and deletion. Notification preferences are not part of the
 * API, so the page says that rather than showing switches that would not save.
 */
export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = React.useState(user?.full_name ?? '');
  const [saving, setSaving] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setFullName(user?.full_name ?? '');
  }, [user?.full_name]);

  if (!user) {
    return (
      <AppPage>
        <PageHeader title="Settings" crumbs={[{ href: '/dashboard', label: 'Overview' }, { label: 'Settings' }]} />
        <LoadingRegion label="Loading your account" />
      </AppPage>
    );
  }

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await authService.updateProfile(fullName.trim());
      await refresh();
      toast.success('Profile updated');
    } catch (error) {
      toast.error(toApiFailure(error).message);
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const result = await authService.resendVerification(user.email);
      toast.success(
        result.dev_verification_url
          ? 'Verification link generated. This deployment logs mail instead of sending it.'
          : 'Verification link sent',
      );
    } catch (error) {
      toast.error(toApiFailure(error).message);
    } finally {
      setResending(false);
    }
  };

  const removeAccount = async () => {
    setDeleting(true);
    try {
      await authService.deleteAccount();
      await logout();
      router.push('/');
    } catch (error) {
      toast.error(toApiFailure(error).message);
      setDeleting(false);
    }
  };

  return (
    <AppPage>
      <PageHeader
        title="Settings"
        crumbs={[{ href: '/dashboard', label: 'Overview' }, { label: 'Settings' }]}
        description="Your account, your email verification state and the plan attached to it."
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings/security">Security</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings/integrations">Integrations</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings/team">Team</Link>
            </Button>
          </>
        }
      />

      {!user.email_verified ? (
        <Callout
          tone="warning"
          title="Your email address is not verified yet"
          action={
            <Button size="sm" variant="secondary" loading={resending} onClick={() => void resend()}>
              Resend link
            </Button>
          }
        >
          Verification does not block scanning, but it is how the account can be recovered if the
          password is lost.
        </Callout>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Profile"
            hint="The display name appears in the workspace menu and on your findings feedback."
            icon={<UserRound className="size-4" />}
          />
          <form onSubmit={saveName} className="px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3.5">
              <Avatar name={user.full_name || user.email} />
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink">{user.full_name || 'No name set'}</p>
                <p className="text-[12.5px] text-muted">{user.email}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Display name" hint="Shown wherever your activity is recorded.">
                {(props) => (
                  <Input
                    {...props}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                  />
                )}
              </Field>

              <Field label="Email address" hint="Changing the address is not supported by the API yet.">
                {(props) => <Input {...props} value={user.email} readOnly disabled />}
              </Field>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                disabled={!fullName.trim() || fullName.trim() === user.full_name}
              >
                Save profile
              </Button>
              {fullName.trim() === user.full_name ? (
                <span className="text-[12.5px] text-muted">No changes to save.</span>
              ) : null}
            </div>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Account" hint="Recorded by the API." />
            <div className="px-5 py-5 sm:px-6">
              <DetailList className="border-t border-hairline">
                <DetailRow label="Plan">
                  <PlanBadge plan={user.plan} />
                </DetailRow>
                <DetailRow label="Email">
                  {user.email_verified ? (
                    <Badge tone="verified">
                      <BadgeCheck className="size-3" aria-hidden="true" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="medium">
                      <MailWarning className="size-3" aria-hidden="true" />
                      Unverified
                    </Badge>
                  )}
                </DetailRow>
                <DetailRow label="Status">{user.is_active ? 'Active' : 'Disabled'}</DetailRow>
                <DetailRow label="Member since">{absoluteDate(user.created_at)}</DetailRow>
              </DetailList>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Notifications"
              hint="Not configurable today."
              icon={<MailWarning className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <p className="text-[13px] leading-relaxed text-body">
                The API does not expose notification preferences yet, so there is nothing to set
                here. Scan completion is visible in the workspace and on the scan page.
              </p>
            </div>
          </Panel>

          <Panel className="border-critical-line">
            <PanelHeader
              title="Delete account"
              hint="Removes the account and everything owned by it."
              icon={<ShieldAlert className="size-4" />}
            />
            <div className="px-5 py-5 sm:px-6">
              <p className="max-w-[60ch] text-[13px] leading-relaxed text-body">
                Deletion is immediate and cannot be undone. Repositories, scans, findings and
                verification records owned by this account go with it. Provider connections are
                revoked.
              </p>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  className="border-critical-line text-critical"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete account
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this account"
        description={`This removes ${user.email} and every repository, scan and finding owned by it. This cannot be undone.`}
        confirmLabel="Delete account"
        destructive
        pending={deleting}
        onConfirm={() => void removeAccount()}
      />
    </AppPage>
  );
}
