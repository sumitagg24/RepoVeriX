import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingService } from '@/services/api';
import type { OnboardingStatus } from '@/types/api';

/** Poll while onboarding is incomplete so steps flip as soon as the user acts. */
export function useOnboardingStatus(options?: { enabled?: boolean }) {
  return useQuery<OnboardingStatus>({
    queryKey: ['onboarding'],
    queryFn: onboardingService.status,
    enabled: options?.enabled ?? true,
    refetchInterval: (query) => (query.state.data?.completed ? false : 4000),
    refetchOnWindowFocus: true,
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: onboardingService.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });
}
