'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { findingService } from '@/services/api';
import type {
  FeedbackSummary,
  Finding,
  FindingDetail,
  FindingFeedback,
  FindingListParams,
  ImpactAnalysis,
  Patch,
  ProofOfFix,
} from '@/types/api';

export const findingKeys = {
  all: ['findings'] as const,
  list: (params: FindingListParams) => ['findings', 'list', params] as const,
  detail: (id: string) => ['findings', 'detail', id] as const,
  impact: (id: string) => ['findings', 'impact', id] as const,
  proof: (id: string) => ['findings', 'proof', id] as const,
  feedback: (id: string) => ['findings', 'feedback', id] as const,
  feedbackSummary: (id: string) => ['findings', 'feedback-summary', id] as const,
};

export function useFindings(params: FindingListParams) {
  return useQuery<Finding[]>({
    queryKey: findingKeys.list(params),
    queryFn: () => findingService.list(params),
  });
}

export function useFinding(id: string | undefined) {
  return useQuery<FindingDetail>({
    queryKey: findingKeys.detail(id ?? ''),
    queryFn: () => findingService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useFindingImpact(id: string | undefined) {
  return useQuery<ImpactAnalysis>({
    queryKey: findingKeys.impact(id ?? ''),
    queryFn: () => findingService.impact(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useProofOfFix(id: string | undefined) {
  return useQuery<ProofOfFix>({
    queryKey: findingKeys.proof(id ?? ''),
    queryFn: () => findingService.proofOfFix(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useMyFeedback(id: string | undefined) {
  return useQuery<FindingFeedback | null>({
    queryKey: findingKeys.feedback(id ?? ''),
    queryFn: () => findingService.myFeedback(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useFeedbackSummary(id: string | undefined) {
  return useQuery<FeedbackSummary>({
    queryKey: findingKeys.feedbackSummary(id ?? ''),
    queryFn: () => findingService.feedbackSummary(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

/** Refreshes everything a finding change can affect. */
function useRefreshFinding(id: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: findingKeys.detail(id) });
    void queryClient.invalidateQueries({ queryKey: findingKeys.proof(id) });
    void queryClient.invalidateQueries({ queryKey: ['findings', 'list'] });
    void queryClient.invalidateQueries({ queryKey: ['billing'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

/*
 * Action hooks accept `string | undefined` so a route can pass its params
 * straight through. They are only ever fired from a rendered detail page, where
 * the id is known; the cast keeps that invariant in one place per hook instead
 * of a non-null assertion at every call site.
 */

export function useGenerateFix(id: string | undefined) {
  const findingId = id ?? '';
  const refresh = useRefreshFinding(findingId);
  return useMutation({
    mutationFn: (): Promise<Patch> => findingService.generateFix(findingId),
    onSuccess: refresh,
  });
}

export function useGenerateTest(id: string | undefined) {
  const findingId = id ?? '';
  const refresh = useRefreshFinding(findingId);
  return useMutation({
    mutationFn: () => findingService.generateTest(findingId),
    onSuccess: refresh,
  });
}

export function useRunGeneratedTest(id: string | undefined) {
  const findingId = id ?? '';
  const refresh = useRefreshFinding(findingId);
  return useMutation({
    mutationFn: ({ testId, patchId }: { testId: string; patchId?: string }) =>
      findingService.runTest(testId, patchId),
    onSuccess: refresh,
  });
}

export function useValidateFinding(id: string | undefined) {
  const findingId = id ?? '';
  const refresh = useRefreshFinding(findingId);
  return useMutation({
    mutationFn: () => findingService.validate(findingId),
    onSuccess: refresh,
  });
}

export function useSubmitFeedback(id: string | undefined) {
  const findingId = id ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      verdict,
      note,
    }: {
      verdict: 'correct' | 'incorrect' | 'already_fixed' | 'not_useful';
      note?: string;
    }) => findingService.submitFeedback(findingId, verdict, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: findingKeys.feedback(findingId) });
      void queryClient.invalidateQueries({ queryKey: findingKeys.feedbackSummary(findingId) });
    },
  });
}

export function useDeleteFeedback(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => findingService.deleteFeedback(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: findingKeys.feedback(id) });
      void queryClient.invalidateQueries({ queryKey: findingKeys.feedbackSummary(id) });
    },
  });
}
