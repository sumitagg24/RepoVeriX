import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryService } from '@/services/api';
import type { Repository, RepositoryCreate } from '@/types/api';

export function useRepositories() {
  return useQuery({
    queryKey: ['repositories'],
    queryFn: repositoryService.list,
  });
}

export function useRepository(id: string | undefined) {
  return useQuery({
    queryKey: ['repository', id],
    queryFn: () => repositoryService.get(id!),
    enabled: !!id,
  });
}

export function useCreateRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: RepositoryCreate) => repositoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}

export function useCreateRepositoryFromZip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) =>
      repositoryService.createFromZip(name, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}

export function useDeleteRepository() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => repositoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
  });
}