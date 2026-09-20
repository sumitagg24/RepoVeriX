'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  repositoryService,
  changeAuditService,
  pullRequestService,
  healthTimelineService,
  architectureSmellsService,
} from '@/services/api';
import type {
  ArchiveImport,
  ChangeAuditListItem,
  ChangeAuditResult,
  HealthTimeline,
  ArchitectureSmells,
  OAuthImport,
  PullRequestAudit,
  Repository,
  RepositoryCreate,
} from '@/types/api';

export const repositoryKeys = {
  all: ['repositories'] as const,
  detail: (id: string) => ['repositories', id] as const,
  intelligence: (id: string) => ['repositories', id, 'intelligence'] as const,
  attackPaths: (id: string) => ['repositories', id, 'attack-paths'] as const,
  dependencies: (id: string) => ['repositories', id, 'dependencies'] as const,
  regression: (id: string, from?: string, to?: string) =>
    ['repositories', id, 'regression', from ?? 'latest', to ?? 'latest'] as const,
  changeAudits: (id: string) => ['repositories', id, 'change-audits'] as const,
  changeAuditDetail: (repoId: string, auditId: string) =>
    ['repositories', repoId, 'change-audits', auditId] as const,
  pullRequests: (id: string) => ['repositories', id, 'pull-requests'] as const,
  healthTimeline: (id: string) => ['repositories', id, 'health-timeline'] as const,
  architectureSmells: (id: string) => ['repositories', id, 'architecture-smells'] as const,
};

export function useRepositories() {
  return useQuery({
    queryKey: repositoryKeys.all,
    queryFn: repositoryService.list,
  });
}

export function useRepository(id: string | undefined) {
  return useQuery({
    queryKey: repositoryKeys.detail(id ?? ''),
    queryFn: () => repositoryService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useRepositoryIntelligence(id: string | undefined) {
  return useQuery({
    queryKey: repositoryKeys.intelligence(id ?? ''),
    queryFn: () => repositoryService.intelligence(id as string),
    enabled: Boolean(id),
  });
}

export function useAttackPaths(id: string | undefined) {
  return useQuery({
    queryKey: repositoryKeys.attackPaths(id ?? ''),
    queryFn: () => repositoryService.attackPaths(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useDependencyReachability(id: string | undefined) {
  return useQuery({
    queryKey: repositoryKeys.dependencies(id ?? ''),
    queryFn: () => repositoryService.dependencyReachability(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useRepositoryRegression(id: string | undefined, params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: repositoryKeys.regression(id ?? '', params?.from, params?.to),
    queryFn: () => repositoryService.regression(id as string, params),
    enabled: Boolean(id),
    retry: false,
  });
}

function useInvalidateRepositories() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: repositoryKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['billing'] });
    void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
  };
}

export function useCreateRepository() {
  const invalidate = useInvalidateRepositories();
  return useMutation({
    mutationFn: (payload: RepositoryCreate): Promise<Repository> => repositoryService.create(payload),
    onSuccess: invalidate,
  });
}

export function useImportFromArchive() {
  const invalidate = useInvalidateRepositories();
  return useMutation({
    mutationFn: (payload: ArchiveImport): Promise<Repository> => repositoryService.createFromArchive(payload),
    onSuccess: invalidate,
  });
}

export function useImportFromZip() {
  const invalidate = useInvalidateRepositories();
  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }): Promise<Repository> =>
      repositoryService.createFromZip(name, file),
    onSuccess: invalidate,
  });
}

export function useImportFromProvider() {
  const invalidate = useInvalidateRepositories();
  return useMutation({
    mutationFn: (payload: OAuthImport): Promise<Repository> => repositoryService.createFromOAuth(payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRepository() {
  const invalidate = useInvalidateRepositories();
  return useMutation({
    mutationFn: (id: string) => repositoryService.remove(id),
    onSuccess: invalidate,
  });
}

export function useChangeAudits(repositoryId: string | undefined) {
  return useQuery<ChangeAuditListItem[]>({
    queryKey: repositoryKeys.changeAudits(repositoryId ?? ''),
    queryFn: () => changeAuditService.list(repositoryId as string),
    enabled: Boolean(repositoryId),
  });
}

export function useChangeAuditDetail(repositoryId: string | undefined, auditId: string | undefined) {
  return useQuery<ChangeAuditResult>({
    queryKey: repositoryKeys.changeAuditDetail(repositoryId ?? '', auditId ?? ''),
    queryFn: () => changeAuditService.get(repositoryId as string, auditId as string),
    enabled: Boolean(repositoryId && auditId),
  });
}

export function usePullRequests(repositoryId: string | undefined) {
  return useQuery<PullRequestAudit[]>({
    queryKey: repositoryKeys.pullRequests(repositoryId ?? ''),
    queryFn: () => pullRequestService.list(repositoryId as string),
    enabled: Boolean(repositoryId),
  });
}

export function useAnalyzePullRequest(repositoryId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { pr_number: number; base_sha?: string; head_sha?: string }) =>
      pullRequestService.analyze(repositoryId as string, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: repositoryKeys.pullRequests(repositoryId ?? '') });
    },
  });
}

export function useHealthTimeline(repositoryId: string | undefined) {
  return useQuery<HealthTimeline>({
    queryKey: repositoryKeys.healthTimeline(repositoryId ?? ''),
    queryFn: () => healthTimelineService.get(repositoryId as string),
    enabled: Boolean(repositoryId),
  });
}

export function useArchitectureSmells(repositoryId: string | undefined) {
  return useQuery<ArchitectureSmells>({
    queryKey: repositoryKeys.architectureSmells(repositoryId ?? ''),
    queryFn: () => architectureSmellsService.get(repositoryId as string),
    enabled: Boolean(repositoryId),
  });
}

