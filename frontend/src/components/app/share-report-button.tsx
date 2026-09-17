'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { scanService } from '@/services/api';
import { Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Creates a secret-URL share for the scan report and copies the link.
 * The link is revocable from the scan page and serves a sanitised,
 * code-free summary (no source paths, snippets or tokens).
 */
export function ShareReportButton({ scanId }: { scanId: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setBusy(true);
    setCopied(false);
    try {
      const created = await scanService.createShare(scanId);
      try {
        await navigator.clipboard.writeText(created.url);
        setCopied(true);
        toast.success('Share link copied — anyone with it can view the summary report');
      } catch {
        // Clipboard can be blocked (permissions / insecure context); fall back
        // to showing the link in a prompt-like toast chain.
        toast(created.url, { duration: 10000, description: 'Copy this share link' });
      }
    } catch {
      toast.error('Could not create share link');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" disabled={busy} onClick={share} title="Create a revocable public link to this report">
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
      {busy ? 'Creating…' : copied ? 'Link copied' : 'Share'}
    </Button>
  );
}
