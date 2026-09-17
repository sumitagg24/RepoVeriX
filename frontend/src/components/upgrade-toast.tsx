'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const REASONS: Record<string, { title: string; message: string }> = {
  // Quota limits (header values from the billing service).
  'repository-cap': {
    title: 'Repository limit reached',
    message: 'Upgrade to keep auditing more repositories.',
  },
  'scan-quota': {
    title: 'Monthly scan quota used up',
    message: 'Upgrade for more scans this cycle — or wait for the reset.',
  },
  'fix-quota': {
    title: 'AI fix quota used up',
    message: 'Upgrade for more automated repair runs.',
  },
  'verify-quota': {
    title: 'Verification quota used up',
    message: 'Upgrade to verify more patches in the sandbox.',
  },
  // Premium tools (plan entitlements).
  'change-audit': {
    title: 'Change audit is a Pro feature',
    message: 'Upgrade to audit changes, impacts and risks.',
  },
  'pull-request-audit': {
    title: 'PR auditor is a Pro feature',
    message: 'Upgrade to audit pull requests with repository evidence.',
  },
  'sarif-export': {
    title: 'SARIF export is a Pro feature',
    message: 'Upgrade to export findings as SARIF 2.1.0.',
  },
  reports: {
    title: 'Audit reports are a Pro feature',
    message: 'Upgrade to download PDF and Markdown reports.',
  },
  'ai-assistant': {
    title: 'AI assistant is a Pro feature',
    message: 'Upgrade for grounded LLM reasoning and answers.',
  },
  'research-llm': {
    title: 'Multi-agent research is a Pro feature',
    message: 'Upgrade to run multi-agent and self-improving analyses.',
  },
  'llm-scan-config': {
    title: 'Full LLM scans are a Pro feature',
    message: 'Free scans run static and hybrid configurations. Upgrade for the full RepoVeriX pipeline.',
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