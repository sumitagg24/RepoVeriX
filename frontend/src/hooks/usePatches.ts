import { useQuery } from '@tanstack/react-query';
import { patchService } from '@/services/api';
import type { Patch, VerificationRun, VerificationRunDetail } from '@/types/api';

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
  return useQuery({
    queryKey: ['patches', 'verifications', patchId],
    queryFn: () => patchService.listVerifications(patchId!),
    enabled: !!patchId,
  });
}

export function useVerificationRun(verificationId: string | undefined) {
  return useQuery({
    queryKey: ['verification', verificationId],
    queryFn: () => patchService.getVerification(verificationId!),
    enabled: !!verificationId,
  });
}