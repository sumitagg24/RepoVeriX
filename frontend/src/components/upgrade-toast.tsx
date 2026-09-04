'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const REASONS: Record<string, { title: string; message: string }> = {
  repositories: {
    title: 'Repository limit reached',
    message: 'Upgrade to keep auditing more repositories.',
  },
  scans: {
    title: 'Monthly scan quota used up',
    message: 'Upgrade for more scans this cycle — or wait for the reset.',
  },
  fixes: {
    title: 'AI fix quota used up',
    message: 'Upgrade for more automated repair runs.',
  },
  verifications: {
    title: 'Verification quota used up',
    message: 'Upgrade to verify more patches in the sandbox.',
  },
  default: {
    title: 'Plan limit reached',
    message: 'Upgrade to keep going.',
  },
};

/** Global listener for 402 (Payment Required) responses → upsell toast. */
export function UpgradeToastListener() {
  const router = useRouter();

  useEffect(() => {
    const onUpgrade = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail ?? {};
      const reason = REASONS[detail.reason ?? 'default'] ?? REASONS.default;
      toast(reason.title, {
        description: reason.message,
        action: {
          label: 'Upgrade',
          onClick: () => router.push('/billing'),
        },
        duration: 8000,
      });
    };
    window.addEventListener('repoverix:upgrade', onUpgrade);
    return () => window.removeEventListener('repoverix:upgrade', onUpgrade);
  }, [router]);

  return null;
}