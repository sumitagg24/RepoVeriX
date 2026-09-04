import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patchService } from '@/services/api';
import type { Patch, VerificationRun, VerificationRunDetail } from '@/types/api';

function isActiveRun(run: VerificationRun): boolean {
  return run.status === 'pending' || run.status === 'running';
}

export function usePatches(params?: {
  finding_id?: string;
  scan_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['patches', params],
    queryFn: () => patchService.list(params),
  });
}

export function usePatch(id: string | undefined) {
  return useQuery({
    queryKey: ['patch', id],
    queryFn: () => patchService.get(id!),
    enabled: !!id,
  });
}

export function usePatchVerifications(patchId: string | undefined) {
  const queryClient = useQueryClient();
  const hadActiveRun = useRef(false);

  const query = useQuery({
    queryKey: ['patches', 'verifications', patchId],
    queryFn: () => patchService.listVerifications(patchId!),
    enabled: !!patchId,
    refetchInterval: (q) => {
      const runs = q.state.data;
      return runs?.some(isActiveRun) ? 1500 : false;
    },
    // Keep polling even when the browser tab loses focus; a verification run
    // finishes server-side and the panel must not stall on "Pending".
    refetchIntervalInBackground: true,
  });

  const runs = query.data;
  const active = runs?.some(isActiveRun) ?? false;

  // When an in-flight verification settles, refresh the patch list so the
  // patch badge/status reflects the terminal outcome.
  useEffect(() => {
    if (hadActiveRun.current && !active) {
      queryClient.invalidateQueries({ queryKey: ['patches'] });
      queryClient.invalidateQueries({ queryKey: ['patch'] });
    }
    if (active) {
      hadActiveRun.current = true;
    }
  }, [active, queryClient]);

  return query;
}

export function useVerificationRun(verificationId: string | undefined) {
  return useQuery({
    queryKey: ['verification', verificationId],
    queryFn: () => patchService.getVerification(verificationId!),
    enabled: !!verificationId,
    refetchInterval: (query) => {
      const run = query.state.data;
      if (run && isActiveRun(run)) {
        return 1500;
      }
      return false;
    },
    refetchIntervalInBackground: true,
  });
}

export function usePatchQuality(patchId: string | undefined) {
  return useQuery({
    queryKey: ['patch-quality', patchId],
    queryFn: () => patchService.quality(patchId!),
    enabled: !!patchId,
    staleTime: 30_000,
    retry: false,
  });
}

export function useVerifyPatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patchId: string): Promise<VerificationRun> => patchService.verify(patchId),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['patches', 'verifications', run.patch_id] });
      queryClient.invalidateQueries({ queryKey: ['patches'] });
    },
  });
}