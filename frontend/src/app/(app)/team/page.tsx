'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { orgService } from '@/services/api';
import type { OrgRead, TeamDashboard, SecurityCenter } from '@/types/api';
import { Loader2, Plus, ShieldCheck, Users, GitBranch, ScanSearch, Bug, Wrench } from 'lucide-react';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

function SeverityChips({ bySeverity }: { bySeverity: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SEVERITY_ORDER.filter((s) => (bySeverity[s] ?? 0) > 0).map((s) => (
        <Badge
          key={s}
          variant={s === 'critical' ? 'destructive' : s === 'high' ? 'destructive' : 'secondary'}
          className="capitalize"
        >
          {s}: {bySeverity[s] ?? 0}
        </Badge>
      ))}
      {SEVERITY_ORDER.every((s) => (bySeverity[s] ?? 0) === 0) && (
        <span className="text-sm text-muted-foreground">No findings</span>
      )}
    </div>
  );
}

export default function TeamPage() {
  const [orgs, setOrgs] = useState<OrgRead[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<TeamDashboard | null>(null);
  const [security, setSecurity] = useState<SecurityCenter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await orgService.listMy();
      setOrgs(list);
      setSelected((prev) => prev ?? list[0]?.id ?? null);
    } catch {
      setError('Could not load your organizations.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    Promise.all([orgService.getDashboard(selected), orgService.getSecurityCenter(selected)])
      .then(([dash, sec]) => {
        if (cancelled) return;
        setDashboard(dash);
        setSecurity(sec);
      })
      .catch(() => setError('Could not load the team dashboard.'));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function createOrg() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const org = await orgService.create({ name: newName.trim() });
      setNewName('');
      await load();
      setSelected(org.id);
    } catch {
      setError('Could not create the organization.');
    } finally {
      setCreating(false);
    }
  }

  if (orgs === null) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading teams…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Team &amp; Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Shared workspaces: members see org repositories, admins manage them.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create an organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="Organization name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void createOrg()}
              />
              <Button onClick={() => void createOrg()} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-8 w-8 opacity-50" />
            You are not part of any organization yet. Create one to share repositories with your team.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Organizations">
          {orgs.map((org) => (
            <button
              key={org.id}
              role="tab"
              aria-selected={selected === org.id}
              onClick={() => setSelected(org.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                selected === org.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {org.name}
              <span className="ml-2 text-xs opacity-70 capitalize">{org.role}</span>
            </button>
          ))}
        </div>
      )}

      {dashboard && security && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <GitBranch className="h-4 w-4" /> Repositories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{dashboard.repository_count}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <ScanSearch className="h-4 w-4" /> Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{dashboard.scans.total}</div>
                <p className="text-xs text-muted-foreground">{dashboard.scans.completed} completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Bug className="h-4 w-4" /> Findings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{dashboard.findings.total}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard.findings.verified_critical_high} verified critical/high
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wrench className="h-4 w-4" /> Verified fixes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{dashboard.fixes.verified}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard.fixes.failed_or_unverified} failed / unverified
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repository risk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SeverityChips bySeverity={dashboard.findings.by_severity} />
              <div className="divide-y">
                {dashboard.repositories.map((repo) => {
                  const row = security.coverage.per_repository.find((r) => r.repository_id === repo.id);
                  return (
                    <div key={repo.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/repositories/${repo.id}`} className="font-medium hover:underline">
                        {repo.name}
                      </Link>
                      <span className="text-muted-foreground">
                        {row ? `${row.findings_total} findings` : 'not scanned yet'}
                      </span>
                    </div>
                  );
                })}
                {dashboard.repositories.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">
                    No repositories attached to this organization yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Security &amp; compliance center
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Posture score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold">{security.posture_score}</span>
                  <Badge variant={security.risk_level === 'none' || security.risk_level === 'low' ? 'secondary' : 'destructive'} className="capitalize">
                    {security.risk_level}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Derived from verified findings — never LLM-assigned.
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Detection quality</p>
                <div className="text-2xl font-semibold">
                  {security.detection_quality.agreement_ratio !== null
                    ? `${Math.round(security.detection_quality.agreement_ratio * 100)}%`
                    : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {security.detection_quality.feedback_total} reviewer verdicts recorded
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fix pipeline</p>
                <div className="text-2xl font-semibold">
                  {security.fix_pipeline.patches_verified}/{security.fix_pipeline.patches_total}
                </div>
                <p className="text-xs text-muted-foreground">patches verified by execution</p>
              </div>
              <div className="md:col-span-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Coverage: {security.coverage.scanned_repositories}/{security.coverage.repositories}{' '}
                  repositories analyzed
                </p>
                <SeverityChips bySeverity={security.findings.by_status} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
