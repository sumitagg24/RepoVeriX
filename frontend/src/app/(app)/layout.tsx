'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { ConsoleShell } from '@/components/rvx/console-shell';
import { useAuth } from '@/context/AuthContext';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { useRepositories } from '@/hooks/useRepositories';

/**
 * Authenticated workspace layout.
 *
 * This file is now only responsible for two things: refusing unauthenticated
 * visitors, and supplying the shell with the workspace context it renders
 * (identity, repositories, aggregate counts). All of the chrome lives in
 * ConsoleShell, so navigation changes no longer require editing a 700-line file
 * that also contains the page's own loading states.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { data: repositories } = useRepositories();
  const { data: summary } = useDashboardSummary();

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="rvx-canvas flex min-h-screen items-center justify-center">
        <p className="rvx-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          restoring session…
        </p>
      </div>
    );
  }

  return (
    <ConsoleShell user={user} repos={repositories} summary={summary}>
      {children}
    </ConsoleShell>
  );
}
