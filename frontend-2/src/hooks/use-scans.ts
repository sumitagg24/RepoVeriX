'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scanService } from '@/services/api';
import type { DedupReport, FindingSummary, ReportShare, Scan, ScanCreate, ScanDetail } from '@/types/api';

export const scanKeys = {
  all: ['scans'] as const,
  list: (repositoryId?: string) => ['scans', repositoryId ?? 'all'] as const,
  detail: (id: string) => ['scans', 'detail', id] as const,
  summary: (id: string) => ['scans', 'summary', id] as const,
  dedup: (id: string) => ['scans', 'dedup', id] as const,
  shares: (id: string) => ['scans', 'shares', id] as const,
};

export function useScans(repositoryId?: string) {
  return useQuery({
    queryKey: scanKeys.list(repositoryId),
    queryFn: () => scanService.list(repositoryId),
  });
}

/** Scans finish in a background worker, so an in-flight scan is polled. */
export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: scanKeys.detail(id ?? ''),
    queryFn: () => scanService.get(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = (query.state.data as ScanDetail | undefined)?.status;
      return status === 'pending' || status === 'running' ? 3000 : false;
    },
  });
}

export function useScanSummary(id: string | undefined) {
  return useQuery({
    queryKey: scanKeys.summary(id ?? ''),
    queryFn: () => scanService.summary(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useScanDedup(id: string | undefined) {
  return useQuery<DedupReport>({
    queryKey: scanKeys.dedup(id ?? ''),
    queryFn: () => scanService.dedup(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useScanShares(id: string | undefined) {
  return useQuery<ReportShare[]>({
    queryKey: scanKeys.shares(id ?? ''),
    queryFn: () => scanService.listShares(id as string),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: ScanCreate; idempotencyKey?: string }): Promise<Scan> =>
      scanService.create(payload, idempotencyKey),
    onSuccess: (scan) => {
      void queryClient.invalidateQueries({ queryKey: scanKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      void queryClient.invalidateQueries({ queryKey: ['repositories'] });
      queryClient.setQueryData(scanKeys.detail(scan.id), scan);
    },
  });
}

export function useCancelScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => scanService.cancel(id),
    onSuccess: (scan) => {
      void queryClient.invalidateQueries({ queryKey: scanKeys.all });
      queryClient.setQueryData(scanKeys.detail(scan.id), scan);
    },
  });
}

export function useCreateShare(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expiryDays: number) => scanService.createShare(id as string, expiryDays),
    onSuccess: () => {
      if (id) void queryClient.invalidateQueries({ queryKey: scanKeys.shares(id) });
    },
  });
}

export function useRevokeShare(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shareId: string) => scanService.revokeShare(shareId),
    onSuccess: () => {
      if (id) void queryClient.invalidateQueries({ queryKey: scanKeys.shares(id) });
    },
  });
}

export type { FindingSummary };
