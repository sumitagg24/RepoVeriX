import type { Metadata } from 'next';
import { ToolsCatalog } from './catalog';

export const metadata: Metadata = {
  title: 'Tools',
  description:
    'Every RepoVeriX capability in one catalog: repository audits, website audits, evidence graphs, verified repair, proof of fix, SARIF export and integrations.',
  openGraph: {
    title: 'Tools',
    description:
      'Repository audits, website audits, evidence graphs, verified repair, proof of fix, SARIF export and integrations.',
  },
};

export default function ToolsPage() {
  // The catalog renders its own MarketingShell; this wrapper only provides the
  // page-level landmark so heading order and the skip target stay correct.
  return (
    <main className="bg-background text-foreground">
      <ToolsCatalog />
    </main>
  );
}
