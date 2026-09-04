'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { billingService } from '@/services/api';
import { toast } from 'sonner';

export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: billingService.overview,
    staleTime: 30_000,
  });
}

export function useCheckout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (plan: string) => billingService.checkout(plan),
    onSuccess: (result) => {
      // Demo mode returns a URL to the billing page with a success flag;
      // live mode opens Stripe Checkout (or the demo URL directly).
      if (result.url) {
        if (result.demo) {
          router.push(result.url.replace(window.location.origin, ''));
        } else {
          window.location.href = result.url;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Checkout could not be started';
      toast.error(message);
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => billingService.portal(),
    onSuccess: (result) => {
      if (result.url) window.location.href = result.url;
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Billing portal unavailable');
    },
  });
}