'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { repositoryService } from '@/services/api';
import type { ArchiveImport, OAuthImport, Repository, RepositoryCreate } from '@/types/api';

export const repositoryKeys = {
  all: ['repositories'] as const,
  detail: (id: string) => ['repositories', id] as const,
  intelligence: (id: string) => ['repositories', id, 'intelligence'] as const,
  attackPaths: (id: string) => ['repositories', id, 'attack-paths'] as const,
  dependencies: (id: string) => ['repositories', id, 'dependencies'] as const,
  regression: (id: string, from?: string, to?: string) =>
    ['repositories', id, 'regression', from ?? 'latest', to ?? 'latest'] as const,
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
