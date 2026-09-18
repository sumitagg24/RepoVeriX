'use client';

import * as React from 'react';

import { useRepositories } from '@/hooks/use-repositories';
import { useScans } from '@/hooks/use-scans';

/**
 * Findings and scans only carry foreign keys, so list screens join them to
 * repository names on the client from data the API already returns. No extra
 * endpoint and no denormalised copies.
 */
export function useRepositoryContext(repositoryId?: string) {
  const repositories = useRepositories();
  const scans = useScans(repositoryId);

  const repositoryNames = React.useMemo(() => {
    const map = new Map<string, string>();
    (repositories.data ?? []).forEach((repo) => map.set(repo.id, repo.name));
    return map;
  }, [repositories.data]);

  const scanToRepository = React.useMemo(() => {
    const map = new Map<string, string>();
    (scans.data ?? []).forEach((scan) => map.set(scan.id, scan.repository_id));
    return map;
  }, [scans.data]);

  return {
    repositories: repositories.data ?? [],
    scans: scans.data ?? [],
    repositoryNames,
    scanToRepository,
    isLoading: repositories.isLoading || scans.isLoading,
    isError: repositories.isError || scans.isError,
    error: repositories.error ?? scans.error,
    refetch: () => {
      void repositories.refetch();
      void scans.refetch();
    },
  };
}
