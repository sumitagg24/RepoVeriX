import type { ReactNode } from 'react';

import { MarketingShell } from '@/components/marketing/marketing-shell';
import { DocsFrame } from './docs-nav';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <DocsFrame>{children}</DocsFrame>
    </MarketingShell>
  );
}
