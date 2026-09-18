import type { Metadata } from 'next';
import { CategoryView } from '@/components/help/category-view';

export const metadata: Metadata = {
  title: 'Integrations and API',
};

export default function HelpApiPage() {
  return (
    <CategoryView
      categoryId="api"
      intro="Connect accounts, export findings as SARIF into GitHub Code Scanning or VS Code, and drive audits from CI."
    />
  );
}
