'use client';

import { useQuery } from '@tanstack/react-query';
import { researchService } from '@/services/api';

export function useMultiAgent(repositoryId: string) {
  return useQuery({
    queryKey: ['multi-agent', repositoryId],
    queryFn: () => researchService.multiAgent(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useSelfImprovement(repositoryId: string) {
  return useQuery({
    queryKey: ['self-improvement', repositoryId],
    queryFn: () => researchService.selfImprovement(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useVulnMining(repositoryId: string) {
  return useQuery({
    queryKey: ['vuln-mining', repositoryId],
    queryFn: () => researchService.vulnMining(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useRiskModel(repositoryId: string) {
  return useQuery({
    queryKey: ['risk-model', repositoryId],
    queryFn: () => researchService.riskModel(repositoryId),
    staleTime: 60_000,
    retry: false,
  });
}

export function useLearningPatterns() {
  return useQuery({
    queryKey: ['learning-patterns'],
    queryFn: () => researchService.learningPatterns(),
    staleTime: 120_000,
    retry: false,
  });
}
