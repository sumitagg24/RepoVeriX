import type { Metadata } from 'next';

import { FindingsExplorer } from '@/components/rvx/findings-explorer';

/**
 * Findings index.
 *
 * The page is a shell: everything that matters — facets, ledger, preview,
 * keyboard model — lives in the explorer component, so this route can change
 * its framing (metadata, permissions, breadcrumbs) without touching the
 * investigation UI.
 */
export const metadata: Metadata = {
  title: 'Findings',
  description: 'Investigate every evidence-backed finding across your repositories.',
};

export default function FindingsPage() {
  return <FindingsExplorer />;
}
