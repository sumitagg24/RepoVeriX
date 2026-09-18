import type { Metadata } from 'next';
import { CategoryView } from '@/components/help/category-view';

export const metadata: Metadata = {
  title: 'Security and privacy',
};

export default function HelpSecurityPage() {
  return (
    <CategoryView
      categoryId="security"
      intro="How your code and accounts are protected: untrusted-repository handling, sandboxed execution, and what we do with your data."
    />
  );
}
