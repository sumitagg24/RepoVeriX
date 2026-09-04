import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { findingService } from '@/services/api';
import type { Finding, FindingDetail, FindingSummary, Patch } from '@/types/api';

export function useFindings(params?: {
  scan_id?: string;
  repository_id?: string;
  category?: string;
  severity?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['findings', params],
    queryFn: () => findingService.list(params),
  });
}

export function useFinding(id: string | undefined) {
  return useQuery({
    queryKey: ['finding', id],
    queryFn: () => findingService.get(id!),
    enabled: !!id,
  });
}

export function useScanFindingsSummary(scanId: string | undefined) {
  return useQuery({
    queryKey: ['findings', 'summary', scanId],
    queryFn: () => findingService.getScanSummary(scanId!),
    enabled: !!scanId,
  });
}

export function useGenerateFix() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (findingId: string): Promise<Patch> => findingService.generateFix(findingId),
    onSuccess: (_, findingId) => {
      queryClient.invalidateQueries({ queryKey: ['finding', findingId] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
    },
  });
}