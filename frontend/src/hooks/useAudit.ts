'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { auditService, findingAuditService, scanAuditService } from '@/services/api';
import { toast } from 'sonner';

function errorDetail(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || (error instanceof Error ? error.message : 'Request failed');
}

export function useEvidenceGraph(repositoryId: string) {
  return useQuery({
    queryKey: ['evidence-graph', repositoryId],
    queryFn: () => auditService.evidenceGraph(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useAttackPaths(repositoryId: string) {
  return useQuery({
    queryKey: ['attack-paths', repositoryId],
    queryFn: () => auditService.attackPaths(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useDependencyReachability(repositoryId: string) {
  return useQuery({
    queryKey: ['dep-reachability', repositoryId],
    queryFn: () => auditService.dependencyReachability(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useRegression(repositoryId: string) {
  return useQuery({
    queryKey: ['regression', repositoryId],
    queryFn: () => auditService.regression(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useChangeAudit() {
  return useMutation({
    mutationFn: ({
      repositoryId,
      payload,
    }: {
      repositoryId: string;
      payload: { base?: string; head?: string; diff?: string };
    }) => auditService.changeAudit(repositoryId, payload),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}

export function useGeneratedTest() {
  const generate = useMutation({
    mutationFn: (findingId: string) => findingAuditService.generateTest(findingId),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
  const run = useMutation({
    mutationFn: (testId: string) => findingAuditService.runTest(testId),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
  return { generate, run };
}

export function useCounterexample() {
  return useMutation({
    mutationFn: (findingId: string) => findingAuditService.validateCounterexample(findingId),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}

export function useDedup(scanId: string) {
  return useQuery({
    queryKey: ['dedup', scanId],
    queryFn: () => scanAuditService.dedup(scanId),
    staleTime: 60_000,
    retry: false,
    enabled: scanId.length > 0,
  });
}