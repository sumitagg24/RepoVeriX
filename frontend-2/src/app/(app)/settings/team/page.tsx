'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { DetailList, DetailRow, Metric, MetricStrip, ProgressBar } from '@/components/ui/metric';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingRegion, SkeletonText } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import { SeverityTally } from '@/components/findings/finding-table';
import {
  useAddMember,
  useAttachRepository,
  useCreateOrganization,
  useDetachRepository,
  useOrganizationMembers,
  useOrganizationRepositories,
  useOrganizations,
  useRemoveMember,
  useSecurityCenter,
  useTeamDashboard,
} from '@/hooks/use-platform';
import { useRepositories } from '@/hooks/use-repositories';
import { formatNumber } from '@/lib/format';
import { toApiFailure } from '@/services/api';
import type { OrgRole } from '@/types/api';

/**
 * Team.
 *
 * Organizations are how the API groups repositories and members. This page reads
 * the same endpoints the workspace uses everywhere else: members, attached
 * repositories, the team dashboard and the security centre, which is where
 * detection quality from reviewer feedback is reported.
 *
 * Role changes are not offered because the API only exposes add and remove, not
 * edit. Inventing a role editor would promise something the backend cannot do.
 */
const ROLES: OrgRole[] = ['member', 'admin', 'owner'];

export default function TeamSettingsPage() {
  const organizations = useOrganizations();
  const createOrganization = useCreateOrganization();
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | undefined>(undefined);
  const [newOrgName, setNewOrgName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<OrgRole>('member');
  const [pendingRemove, setPendingRemove] = React.useState<string | null>(null);

  // Memoised so the effect below depends on a stable array reference rather
  // than a fresh `[]` on every render while the query is still loading.
  const orgs = React.useMemo(() => organizations.data ?? [], [organizations.data]);
  const activeOrg = orgs.find((org) => org.id === selectedOrgId) ?? orgs[0];

  React.useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) setSelectedOrgId(orgs[0].id);
  }, [orgs, selectedOrgId]);

  const members = useOrganizationMembers(activeOrg?.id);
  const attached = useOrganizationRepositories(activeOrg?.id);
  const dashboard = useTeamDashboard(activeOrg?.id);
  const securityCenter = useSecurityCenter(activeOrg?.id);
  const addMember = useAddMember(activeOrg?.id);
  const removeMember = useRemoveMember(activeOrg?.id);
  const attachRepository = useAttachRepository(activeOrg?.id);
  const detachRepository = useDetachRepository(activeOrg?.id);
  const repositories = useRepositories();

  const canManage = activeOrg?.role === 'admin' || activeOrg?.role === 'owner';

  const attachable = React.useMemo(() => {
    const attachedIds = new Set((attached.data ?? []).map((repo) => repo.id));
    return (repositories.data ?? []).filter((repository) => !attachedIds.has(repository.id));
  }, [attached.data, repositories.data]);

  return (
    <AppPage>
      <PageHeader
        title="Team"
        crumbs={[{ href: '/settings', label: 'Settings' }, { label: 'Team' }]}
        description="Organizations group repositories and members, and report posture across them."
      />

      {organizations.isError ? (
        <ErrorState
          title="Could not load organizations"
          body="The organizations endpoint did not answer."
          onRetry={() => void organizations.refetch()}
        />
      ) : null}

      {organizations.isLoading ? <LoadingRegion label="Loading organizations" /> : null}

      {!organizations.isLoading && orgs.length === 0 ? (
        <Panel>
          <PanelHeader
            title="Create the first organization"
            hint="An organization is what lets a scan result carry a team's posture rather than one account's."
            icon={<Users className="size-4" />}
          />
          <form
            className="px-5 py-5 sm:px-6"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                const org = await createOrganization.mutateAsync({ name: newOrgName.trim() });
                setNewOrgName('');
                setSelectedOrgId(org.id);
                toast.success(`${org.name} created`);
              } catch (error) {
                toast.error(toApiFailure(error).message);
              }
            }}
          >
            <div className="max-w-md">
              <Field label="Organization name" hint="Appears on team dashboards and reports." required>
                {(props) => (
                  <Input
                    {...props}
                    value={newOrgName}
                    onChange={(event) => setNewOrgName(event.target.value)}
                    placeholder="Platform security"
                    required
                  />
                )}
              </Field>
            </div>
            <div className="mt-4">
              <Button type="submit" variant="primary" loading={createOrganization.isPending}>
                <Plus className="size-4" aria-hidden="true" />
                Create organization
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}

      {orgs.length > 0 && activeOrg ? (
        <>
          <Panel>
            <PanelHeader
              title="Organization"
              hint="Switch organizations to see their members, repositories and posture."
              actions={
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{activeOrg.role}</Badge>
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/settings">Account settings</Link>
                  </Button>
                </div>
              }
            />
            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2">
              <Field label="Active organization">
                {(props) => (
                  <Select value={activeOrg.id} onValueChange={setSelectedOrgId}>
                    <SelectTrigger id={props.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name} · {org.role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    const org = await createOrganization.mutateAsync({ name: newOrgName.trim() });
                    setNewOrgName('');
                    setSelectedOrgId(org.id);
                    toast.success(`${org.name} created`);
                  } catch (error) {
                    toast.error(toApiFailure(error).message);
                  }
                }}
              >
                <Field label="Create another organization">
                  {(props) => (
                    <Input
                      {...props}
                      value={newOrgName}
                      onChange={(event) => setNewOrgName(event.target.value)}
                      placeholder="Name"
                    />
                  )}
                </Field>
                <div className="mt-3">
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={createOrganization.isPending}
                    disabled={!newOrgName.trim()}
                  >
                    Create
                  </Button>
                </div>
              </form>
            </div>
          </Panel>

          <MetricStrip>
            <Metric
              label="Repositories"
              value={formatNumber(dashboard.data?.repository_count ?? 0)}
              hint={`${attached.data?.length ?? 0} attached to this organization`}
            />
            <Metric
              label="Scans"
              value={formatNumber(dashboard.data?.scans.total ?? 0)}
              hint={`${formatNumber(dashboard.data?.scans.completed ?? 0)} completed`}
            />
            <Metric
              label="Findings"
              value={formatNumber(dashboard.data?.findings.total ?? 0)}
              hint={`${formatNumber(dashboard.data?.findings.verified_critical_high ?? 0)} verified critical or high`}
              tone="critical"
            />
            <Metric
              label="Verified fixes"
              value={formatNumber(dashboard.data?.fixes.verified ?? 0)}
              hint={`${formatNumber(dashboard.data?.fixes.failed_or_unverified ?? 0)} failed or unverified`}
              tone="verified"
            />
          </MetricStrip>

          <Tabs defaultValue="members" className="space-y-6">
            <TabsList label="Team sections">
              <TabsTrigger value="members" count={members.data?.length}>
                Members
              </TabsTrigger>
              <TabsTrigger value="repositories" count={attached.data?.length}>
                Repositories
              </TabsTrigger>
              <TabsTrigger value="posture">Posture</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-4">
              {canManage ? (
                <Panel>
                  <PanelHeader
                    title="Add a member"
                    hint="The person needs an account already. Adding them attaches that account to this organization."
                    icon={<UserPlus className="size-4" />}
                  />
                  <form
                    className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      try {
                        await addMember.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
                        setInviteEmail('');
                        toast.success('Member added');
                      } catch (error) {
                        toast.error(toApiFailure(error).message);
                      }
                    }}
                  >
                    <Field label="Email address" required>
                      {(props) => (
                        <Input
                          {...props}
                          type="email"
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder="teammate@example.com"
                          required
                        />
                      )}
                    </Field>
                    <Field label="Role">
                      {(props) => (
                        <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as OrgRole)}>
                          <SelectTrigger id={props.id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                    <div className="flex items-end">
                      <Button type="submit" variant="primary" loading={addMember.isPending}>
                        Add member
                      </Button>
                    </div>
                  </form>
                </Panel>
              ) : (
                <Callout tone="info" title="You have read-only access to this organization">
                  Only admins and owners can add or remove members. Your role is {activeOrg.role}.
                </Callout>
              )}

              <Panel>
                <PanelHeader title="Members" hint="Everyone attached to this organization." />
                <div className="px-5 py-5 sm:px-6">
                  {members.isLoading ? <SkeletonText lines={3} /> : null}
                  {(members.data ?? []).length === 0 && !members.isLoading ? (
                    <EmptyState
                      icon={<Users className="size-4" aria-hidden="true" />}
                      title="No members yet"
                      body="An organization with no members cannot report team posture. Add the people who triage findings."
                    />
                  ) : null}
                  {(members.data ?? []).length > 0 ? (
                    <ul className="divide-y divide-hairline border-t border-hairline">
                      {(members.data ?? []).map((member) => (
                        <li
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-medium text-ink">
                              {member.full_name ?? member.email ?? member.user_id.slice(0, 8)}
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-muted">
                              {member.email ?? 'email not recorded'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <Badge tone={member.role === 'owner' ? 'accent' : 'neutral'}>
                              {member.role}
                            </Badge>
                            {canManage ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPendingRemove(member.id)}
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                                Remove
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="repositories" className="space-y-4">
              <Panel>
                <PanelHeader
                  title="Attached repositories"
                  hint="Attaching a repository puts its findings into this organization's posture."
                />
                <div className="px-5 py-5 sm:px-6">
                  {attached.isLoading ? <SkeletonText lines={3} /> : null}
                  {(attached.data ?? []).length === 0 && !attached.isLoading ? (
                    <EmptyState
                      title="No repositories attached"
                      body="Attach an imported repository to include its scans and findings in team reporting."
                    />
                  ) : null}
                  {(attached.data ?? []).length > 0 ? (
                    <ul className="divide-y divide-hairline border-t border-hairline">
                      {(attached.data ?? []).map((repo) => (
                        <li key={repo.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <Link
                              href={`/repositories/${repo.id}`}
                              className="text-[13.5px] font-medium text-ink transition-colors hover:text-accent"
                            >
                              {repo.name}
                            </Link>
                            <p className="mt-0.5 font-mono text-[11.5px] text-muted">
                              {repo.source_type} · {repo.status}
                              {repo.languages.length > 0 ? ` · ${repo.languages.join(', ')}` : ''}
                            </p>
                          </div>
                          {canManage ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={detachRepository.isPending}
                              onClick={() =>
                                void detachRepository
                                  .mutateAsync(repo.id)
                                  .then(() => toast.success('Repository detached'))
                                  .catch((error) => toast.error(toApiFailure(error).message))
                              }
                            >
                              Detach
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {canManage && attachable.length > 0 ? (
                    <div className="mt-5 border-t border-hairline pt-5">
                      <h3 className="text-[13.5px] font-medium text-ink">Attach another repository</h3>
                      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {attachable.slice(0, 8).map((repository) => (
                          <li
                            key={repository.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface px-3.5 py-2.5"
                          >
                            <span className="min-w-0 truncate text-[13px] text-ink">
                              {repository.name}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={attachRepository.isPending}
                              onClick={() =>
                                void attachRepository
                                  .mutateAsync(repository.id)
                                  .then(() => toast.success('Repository attached'))
                                  .catch((error) => toast.error(toApiFailure(error).message))
                              }
                            >
                              Attach
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="posture" className="space-y-6">
              {securityCenter.isLoading ? <LoadingRegion label="Loading security centre" /> : null}

              {securityCenter.isError ? (
                <Callout tone="info" title="The security centre report is not available">
                  It is assembled from scans across the attached repositories. Attach a repository and
                  run a scan to populate it.
                </Callout>
              ) : null}

              {securityCenter.data ? (
                <>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <Panel>
                      <PanelHeader
                        title="Posture"
                        hint="A composite of severity, validation outcome and reachability."
                        icon={<ShieldCheck className="size-4" />}
                      />
                      <div className="px-5 py-5 sm:px-6">
                        <p data-numeric className="text-[32px] font-semibold leading-none tracking-tight text-ink">
                          {securityCenter.data.posture_score}
                          <span className="text-[14px] font-normal text-muted"> / 100</span>
                        </p>
                        <p className="mt-2 text-[13px] text-body">
                          Risk level: {securityCenter.data.risk_level}
                        </p>
                        <div className="mt-4">
                          <ProgressBar
                            label="Posture score"
                            value={securityCenter.data.posture_score}
                            tone={securityCenter.data.risk_level === 'high' ? 'critical' : 'accent'}
                          />
                        </div>
                        <DetailList className="mt-5 border-t border-hairline">
                          <DetailRow label="Repositories in scope">
                            {formatNumber(securityCenter.data.coverage.repositories)}
                          </DetailRow>
                          <DetailRow label="Repositories scanned">
                            {formatNumber(securityCenter.data.coverage.scanned_repositories)}
                          </DetailRow>
                          <DetailRow label="Fixes verified">
                            {formatNumber(securityCenter.data.fix_pipeline.patches_verified)} of{' '}
                            {formatNumber(securityCenter.data.fix_pipeline.patches_total)}
                          </DetailRow>
                        </DetailList>
                      </div>
                    </Panel>

                    <Panel>
                      <PanelHeader
                        title="Detection quality"
                        hint="From reviewer verdicts recorded on findings. This is your workspace's own number, not a vendor claim."
                      />
                      <div className="px-5 py-5 sm:px-6">
                        <DetailList className="border-t border-hairline">
                          <DetailRow label="Verdicts recorded">
                            {formatNumber(securityCenter.data.detection_quality.feedback_total)}
                          </DetailRow>
                          <DetailRow label="Agreement">
                            {securityCenter.data.detection_quality.agreement_ratio == null
                              ? 'Not enough verdicts yet'
                              : `${Math.round(securityCenter.data.detection_quality.agreement_ratio * 100)}%`}
                          </DetailRow>
                        </DetailList>
                        <ul className="mt-4 space-y-2">
                          {Object.entries(securityCenter.data.detection_quality.verdicts).map(
                            ([verdict, count]) => (
                              <li
                                key={verdict}
                                className="flex items-center justify-between gap-3 text-[13px]"
                              >
                                <span className="text-body">{verdict.replace(/_/g, ' ')}</span>
                                <span data-numeric className="font-mono text-[12.5px] text-ink">
                                  {formatNumber(count)}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </Panel>
                  </div>

                  <Panel>
                    <PanelHeader
                      title="Findings across the organization"
                      hint="Severity recorded on every attached repository."
                    />
                    <div className="px-5 py-5 sm:px-6">
                      <SeverityTally bySeverity={securityCenter.data.findings.by_severity} />
                    </div>
                  </Panel>

                  {securityCenter.data.coverage.per_repository.length > 0 ? (
                    <Panel>
                      <PanelHeader title="Coverage per repository" />
                      <div className="px-5 py-5 sm:px-6">
                        <ul className="divide-y divide-hairline border-t border-hairline">
                          {securityCenter.data.coverage.per_repository.map((row) => (
                            <li
                              key={row.repository_id}
                              className="flex items-center justify-between gap-3 py-2.5"
                            >
                              <Link
                                href={`/repositories/${row.repository_id}`}
                                className="min-w-0 truncate text-[13.5px] text-ink transition-colors hover:text-accent"
                              >
                                {row.repository_name}
                              </Link>
                              <span data-numeric className="shrink-0 font-mono text-[12.5px] text-muted">
                                {formatNumber(row.findings_total)} findings
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Panel>
                  ) : null}
                </>
              ) : null}
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove this member"
        description="They lose access to this organization's repositories and reporting. Their own account and repositories are untouched."
        confirmLabel="Remove member"
        destructive
        pending={removeMember.isPending}
        onConfirm={async () => {
          if (!pendingRemove) return;
          try {
            await removeMember.mutateAsync(pendingRemove);
            toast.success('Member removed');
            setPendingRemove(null);
          } catch (error) {
            toast.error(toApiFailure(error).message);
          }
        }}
      />
    </AppPage>
  );
}
