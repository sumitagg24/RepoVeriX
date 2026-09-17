import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { websiteService } from '@/services/api';

export function useWebsites() {
  return useQuery({ queryKey: ['websites'], queryFn: () => websiteService.list() });
}

export function useRegisterWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => websiteService.register(url),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['websites'] }),
  });
}

export function useDeleteWebsite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => websiteService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['websites'] }),
  });
}

export function useWebsiteAudits(websiteId: string | undefined) {
  return useQuery({
    queryKey: ['website-audits', websiteId],
    queryFn: () => websiteService.listAudits(websiteId!),
    enabled: !!websiteId,
  });
}

export function useCreateWebsiteAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { websiteId: string; params?: { max_pages?: number; max_depth?: number } }) =>
      websiteService.createAudit(args.websiteId, args.params),
    onSuccess: (audit) => {
      queryClient.invalidateQueries({ queryKey: ['website-audits', audit.website_id] });
      queryClient.invalidateQueries({ queryKey: ['website-audit', audit.website_id, audit.id] });
    },
  });
}

export function useWebsiteAudit(websiteId: string | undefined, auditId: string | undefined) {
  return useQuery({
    queryKey: ['website-audit', websiteId, auditId],
    queryFn: () => websiteService.getAudit(websiteId!, auditId!),
    enabled: !!websiteId && !!auditId,
    // Poll while the audit is still in flight so progress appears live.
    refetchInterval: (query) =>
      ['pending', 'running'].includes(query.state.data?.status ?? '') ? 3000 : false,
  });
}
