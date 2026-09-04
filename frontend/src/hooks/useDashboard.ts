import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/api';
import type { DashboardSummary } from '@/types/api';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardService.getSummary,
    refetchInterval: 30000,
  });
}