'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  auditService,
  findingAuditService,
  intelligenceService,
  scanAuditService,
} from '@/services/api';
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
    mutationFn: ({ testId, patchId }: { testId: string; patchId?: string }) =>
      findingAuditService.runTest(testId, patchId),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
  return { generate, run };
}

export function useProofOfFix(findingId: string | undefined) {
  return useQuery({
    queryKey: ['proof-of-fix', findingId],
    queryFn: () => findingAuditService.proofOfFix(findingId as string),
    enabled: Boolean(findingId),
  });
}

export function useCounterexample() {
  return useMutation({
    mutationFn: (findingId: string) => findingAuditService.validateCounterexample(findingId),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}

export function useValidateFinding() {
  return useMutation({
    mutationFn: (findingId: string) => findingAuditService.validateFinding(findingId),
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

// --------------------------------------------------------------------------- Tier 2

export function useRepoQuery(repositoryId: string) {
  return useMutation({
    mutationFn: ({ question, useLlm }: { question: string; useLlm: boolean }) =>
      intelligenceService.query(repositoryId, question, useLlm),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}

export function useArchitectureSmells(repositoryId: string) {
  return useQuery({
    queryKey: ['architecture-smells', repositoryId],
    queryFn: () => intelligenceService.architectureSmells(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useHealthTimeline(repositoryId: string) {
  return useQuery({
    queryKey: ['health-timeline', repositoryId],
    queryFn: () => intelligenceService.healthTimeline(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useExplainChange() {
  return useMutation({
    mutationFn: ({
      repositoryId,
      payload,
    }: {
      repositoryId: string;
      payload: { base?: string; head?: string; diff?: string };
    }) => auditService.explainChange(repositoryId, payload),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}

export function useFindingImpact(findingId: string) {
  return useQuery({
    queryKey: ['finding-impact', findingId],
    queryFn: () => findingAuditService.impact(findingId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useFindingChat() {
  return useMutation({
    mutationFn: ({ findingId, question, useLlm }: { findingId: string; question: string; useLlm: boolean }) =>
      findingAuditService.chat(findingId, question, useLlm),
    onError: (error: unknown) => toast.error(errorDetail(error)),
  });
}