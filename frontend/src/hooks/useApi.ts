"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type {
  DashboardSummary,
  FindingDetail,
  FindingRead,
  PatchRead,
  RepositoryRead,
  ScanDetail,
  ScanRead,
  VerificationRunDetail,
  VerificationRunRead,
} from "@/types/api";

/* ---------- dashboard ---------- */
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardSummary>("/dashboard/summary")).data,
  });
}

/* ---------- repositories ---------- */
export function useRepositories() {
  return useQuery({
    queryKey: ["repositories"],
    queryFn: async () =>
      (await api.get<RepositoryRead[]>("/repositories")).data,
  });
}

export function useRepository(id?: string) {
  return useQuery({
    queryKey: ["repository", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<RepositoryRead>(`/repositories/${id}`)).data,
  });
}

export function useCreateRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      source_type: string;
      source_url?: string;
      default_branch?: string;
    }) => (await api.post<RepositoryRead>("/repositories", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

export function useUploadRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const form = new FormData();
      form.append("name", name);
      form.append("file", file);
      const res = await api.post<RepositoryRead>("/repositories/zip", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

export function useDeleteRepository() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/repositories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repositories"] }),
  });
}

/* ---------- scans ---------- */
export function useScans(repositoryId?: string) {
  return useQuery({
    queryKey: ["scans", repositoryId ?? "all"],
    queryFn: async () =>
      (
        await api.get<ScanRead[]>("/scans", {
          params: repositoryId ? { repository_id: repositoryId } : undefined,
        })
      ).data,
  });
}

export function useScan(id?: string, poll = false) {
  return useQuery({
    queryKey: ["scan", id],
    enabled: !!id,
    refetchInterval: poll ? 4000 : false,
    queryFn: async () => (await api.get<ScanDetail>(`/scans/${id}`)).data,
  });
}

export function useStartScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { repository_id: string; configuration: string }) =>
      (await api.post<ScanRead>("/scans", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scans"] }),
  });
}

export function useCancelScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/scans/${id}/cancel`);
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["scans"] });
      qc.invalidateQueries({ queryKey: ["scan", id] });
    },
  });
}

/* ---------- findings ---------- */
export function useFindings(params?: {
  scan_id?: string;
  repository_id?: string;
  severity?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ["findings", params],
    queryFn: async () =>
      (await api.get<FindingRead[]>("/findings", { params })).data,
  });
}

export function useFinding(id?: string) {
  return useQuery({
    queryKey: ["finding", id],
    enabled: !!id,
    queryFn: async () =>
      (await api.get<FindingDetail>(`/findings/${id}`)).data,
  });
}

export function useGenerateFix() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (findingId: string) =>
      (await api.post<PatchRead>(`/findings/${findingId}/generate-fix`)).data,
    onSuccess: (_d, findingId) =>
      qc.invalidateQueries({ queryKey: ["finding", findingId] }),
  });
}

/* ---------- patches / verification ---------- */
export function useVerifyPatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patchId: string) =>
      (
        await api.post<VerificationRunRead>(`/patches/${patchId}/verify`)
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finding"] }),
  });
}

export function useVerification(id?: string, poll = false) {
  return useQuery({
    queryKey: ["verification", id],
    enabled: !!id,
    refetchInterval: poll ? 4000 : false,
    queryFn: async () =>
      (await api.get<VerificationRunDetail>(`/patches/verification/${id}`))
        .data,
  });
}

export function usePatchVerifications(patchId?: string) {
  return useQuery({
    queryKey: ["patch-verifications", patchId],
    enabled: !!patchId,
    queryFn: async () =>
      (
        await api.get<VerificationRunRead[]>(
          `/patches/${patchId}/verifications`,
        )
      ).data,
  });
}
