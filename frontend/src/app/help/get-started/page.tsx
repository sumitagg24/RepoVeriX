import type { Metadata } from 'next';
import { CategoryView } from '@/components/help/category-view';

export const metadata: Metadata = {
  title: 'Get started - RepoVeriX Help',
};

export default function HelpGetStartedPage() {
  return (
    <CategoryView
      categoryId="get-started"
      intro="New to RepoVeriX? Import a repository, run a scan and inspect your first evidence chain — most audits are minutes, not hours."
    />
  );
}
