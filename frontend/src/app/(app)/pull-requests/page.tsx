'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, GitPullRequest, ShieldAlert, ArrowRight } from 'lucide-react';
import { useRepositories } from '@/hooks/useRepositories';
import { useAnalyzePullRequest, usePullRequestAudits } from '@/hooks/usePullRequests';
import { RiskBadge } from '@/components/audit/risk-gauge';
import { formatDistanceToNow } from 'date-fns';

export default function PullRequestsPage() {
  const router = useRouter();
  const repos = useRepositories();
  const audits = usePullRequestAudits();
  const analyze = useAnalyzePullRequest();

  const githubRepos = useMemo(
    () =>
      (repos.data ?? []).filter(
        (r) => r.source_type === 'github' || r.source_type === 'git'
      ),
    [repos.data]
  );

  const [repoId, setRepoId] = useState('');
  const [prNumber, setPrNumber] = useState('');

  const selectedRepo = (repos.data ?? []).find((r) => r.id === repoId);

  const run = () => {
    const n = parseInt(prNumber, 10);
    if (!repoId || !n) return;
    analyze.mutate(
      { repositoryId: repoId, prNumber: n },
      {
        onSuccess: (detail) => {
          if (detail?.audit_id) {
            router.push(`/pull-requests/${detail.audit_id}`);
          }
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <GitPullRequest className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pull Request Auditor</h1>
          <p className="text-muted-foreground mt-1">
            Audit a GitHub PR against the repository&apos;s full context — impact, evidence-grounded findings,
            regression risks — then post the review as inline comments when you&apos;re ready.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" /> Audit a pull request
          </CardTitle>
        </CardHeader>
        <CardContent>
          {repos.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading repositories…
            </div>
          ) : githubRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              PR auditing works on repositories imported from GitHub. Import a GitHub repository first, then audit
              its pull requests here.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Repository</label>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={repoId}
                    onChange={(e) => setRepoId(e.target.value)}
                  >
                    <option value="">Choose a repository…</option>
                    {githubRepos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">PR number</label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 12"
                    value={prNumber}
                    onChange={(e) => setPrNumber(e.target.value)}
                  />
                </div>
                <Button onClick={run} disabled={!repoId || !prNumber || analyze.isPending}>
                  {analyze.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitPullRequest className="mr-2 h-4 w-4" />}
                  {analyze.isPending ? 'Analyzing…' : 'Run PR audit'}
                </Button>
              </div>
              {selectedRepo?.source_url && (
                <p className="text-xs text-muted-foreground font-mono truncate">{selectedRepo.source_url}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {audits.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading audits…
            </div>
          ) : (audits.data ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No PR audits yet. Analyze a pull request above and its review will appear here.
            </p>
          ) : (
            <div className="divide-y">
              {(audits.data ?? []).map((audit) => (
                <Link
                  key={audit.id}
                  href={`/pull-requests/${audit.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">
                        {audit.repository_name ? `${audit.repository_name} · ` : ''}PR #{audit.pr_number}
                      </span>
                      {audit.posted && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                          Posted
                        </Badge>
                      )}
                    </div>
                    {audit.pr_title && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{audit.pr_title}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {audit.changed_files?.length ?? 0} files · {audit.finding_count} findings ·{' '}
                      {audit.base_ref ?? '?'}…{audit.head_ref ?? '?'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {audit.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(audit.created_at), { addSuffix: true })}
                      </span>
                    )}
                    <RiskBadge level={audit.risk_level} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
