'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { intelligenceService } from '@/services/api';
import { toast } from 'sonner';

export function useIntelligence(repositoryId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['intelligence', repositoryId],
    queryFn: () => intelligenceService.get(repositoryId),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const refresh = useMutation({
    mutationFn: () => intelligenceService.get(repositoryId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence', repositoryId] });
      toast.success('Intelligence index refreshed');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Refresh failed');
    },
  });

  const prose = useMutation({
    mutationFn: (path: string) => intelligenceService.wikiProse(repositoryId, path),
    onError: (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || (error instanceof Error ? error.message : 'Could not generate prose'));
    },
  });

  return { ...query, refresh, prose };
}