'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prAuditService } from '@/services/api';
import { toast } from 'sonner';

function errorDetail(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || (error instanceof Error ? error.message : 'Request failed');
}

export function usePullRequestAudits(params?: { repository_id?: string }) {
  return useQuery({
    queryKey: ['pr-audits', params?.repository_id ?? 'all'],
    queryFn: () => prAuditService.list(params),
    staleTime: 30_000,
    retry: false,
  });
}

export function usePullRequestAudit(auditId: string) {
  return useQuery({
    queryKey: ['pr-audit', auditId],
    queryFn: () => prAuditService.get(auditId),
    staleTime: 30_000,
    retry: false,
    enabled: auditId.length > 0,
  });
}

export function useAnalyzePullRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, prNumber }: { repositoryId: string; prNumber: number }) =>
      prAuditService.analyze(repositoryId, prNumber),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pr-audits'] });
      if (data?.audit_id) {
        queryClient.invalidateQueries({ queryKey: ['pr-audit', data.audit_id] });
      }
      toast.success(
        data?.pr?.number ? `PR #${data.pr.number} audited — risk ${data.risk_score}/100` : 'PR audit complete'
      );
    },
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}

export function usePostPullRequestReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, auditId }: { repositoryId: string; auditId: string }) =>
      prAuditService.postReview(repositoryId, auditId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-audits'] });
      queryClient.invalidateQueries({ queryKey: ['pr-audit'] });
      toast.success('Review posted to GitHub');
    },
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}
