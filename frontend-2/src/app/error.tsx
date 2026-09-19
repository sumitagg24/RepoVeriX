'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Shell } from '@/components/layout/shell';

/**
 * Route-level error boundary.
 *
 * States what failed, offers a retry that actually re-renders the segment, and
 * shows the Next.js digest so a report can be traced. No apology theatre.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surfaced in the browser console for local debugging; production logging
    // belongs to the deployment, not the client.
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-dvh items-center py-16">
      <Shell>
        <div className="max-w-xl">
          <p className="font-mono text-[12px] text-critical">Render error</p>
          <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">
            This view failed to render
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-body">
            The page hit an error while rendering. Retrying re-renders this section; if it keeps
            failing, the error digest below identifies the failure in server logs.
          </p>
          <p className="mt-4 break-words rounded-md border border-hairline bg-surface px-3 py-2 font-mono text-[12px] text-muted">
            {error.message || 'Unknown error'}
            {error.digest ? ` · digest ${error.digest}` : ''}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" onClick={reset}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Try again
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dashboard">Back to overview</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/help">Get help</Link>
            </Button>
          </div>
        </div>
      </Shell>
    </main>
  );
}
