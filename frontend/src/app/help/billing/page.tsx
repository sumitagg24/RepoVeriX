import type { Metadata } from 'next';
import { CategoryView } from '@/components/help/category-view';

export const metadata: Metadata = {
  title: 'Billing and plans',
};

export default function HelpBillingPage() {
  return (
    <CategoryView
      categoryId="billing"
      intro="Plans, monthly quotas and upgrades. Quotas block an action with an upgrade prompt — never a surprise charge."
    />
  );
}
