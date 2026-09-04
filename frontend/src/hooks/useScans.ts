import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scanService } from '@/services/api';
import type { Scan, ScanCreate, ScanDetail } from '@/types/api';

export function useScans(repositoryId?: string) {
  return useQuery({
    queryKey: ['scans', repositoryId],
    queryFn: () => scanService.list(repositoryId),
  });
}

export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: ['scan', id],
    queryFn: () => scanService.get(id!),
    enabled: !!id,
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: ScanCreate) => scanService.create(data),
    onSuccess: (newScan) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scans', newScan.repository_id] });
    },
  });
}

export function useCancelScan() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => scanService.cancel(id),
    onSuccess: (_, scanId) => {
      queryClient.invalidateQueries({ queryKey: ['scans'] });
      queryClient.invalidateQueries({ queryKey: ['scan', scanId] });
    },
  });
}