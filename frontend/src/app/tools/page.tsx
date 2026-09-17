import type { Metadata } from 'next';
import { ToolsCatalog } from './catalog';

export const metadata: Metadata = {
  title: 'Tools — RepoVeriX',
  description:
    'Every RepoVeriX capability in one catalog: repository audits, website audits, evidence graphs, verified repair, proof of fix, SARIF export and integrations.',
  openGraph: {
    title: 'Tools — RepoVeriX',
    description:
      'Repository audits, website audits, evidence graphs, verified repair, proof of fix, SARIF export and integrations.',
  },
};

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ToolsCatalog />
    </main>
  );
}
