'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { AuthProvider } from '@/context/auth-context';
import { ThemeProvider } from '@/context/theme-context';
import { TooltipProvider } from '@/components/ui/tooltip';
import { UPGRADE_EVENT } from '@/services/api';

/** One client per browser session; transient failures retry once. */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) => {
          const status = (error as { response?: { status?: number } })?.response?.status;
          // 4xx is a decision the server already made — retrying cannot change it.
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

/**
 * Plan-limit notices.
 *
 * The API answers 402 with an `x-upgrade-reason` header when a plan gate is
 * hit. The interceptor re-broadcasts it, and this listener turns it into one
 * consistent notice with a route to billing, so no screen invents its own.
 */
function UpgradeListener() {
  React.useEffect(() => {
    const handler = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
      void import('sonner').then(({ toast }) => {
        toast.warning('Plan limit reached', {
          description: reason
            ? `Not included in the current plan: ${reason.replace(/-/g, ' ')}.`
            : 'This action is not included in your current plan.',
          action: { label: 'Billing', onClick: () => (window.location.href = '/billing') },
        });
      });
    };
    window.addEventListener(UPGRADE_EVENT, handler);
    return () => window.removeEventListener(UPGRADE_EVENT, handler);
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200} skipDelayDuration={300}>
            <UpgradeListener />
            {children}
            <Toaster
              position="bottom-right"
              closeButton
              toastOptions={{
                classNames: {
                  toast: 'rounded-lg border border-hairline bg-card text-ink text-[13px] shadow-overlay',
                  description: 'text-muted',
                  actionButton: 'rounded-md bg-chrome text-chrome-label px-2 py-1 text-xs font-medium',
                  cancelButton: 'rounded-md border border-hairline px-2 py-1 text-xs text-body',
                },
              }}
            />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
