import type { Metadata } from 'next';

import { AppShell } from '@/components/app/app-shell';

/**
 * Authenticated routes are never indexed, and they all render inside one shell,
 * so the sidebar, topbar and session handling cannot drift between pages.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
