import type { Metadata } from 'next';
import { CategoryView } from '@/components/help/category-view';

export const metadata: Metadata = {
  title: 'Troubleshooting and support - RepoVeriX Help',
};

export default function HelpTroubleshootingPage() {
  return (
    <CategoryView
      categoryId="troubleshooting"
      intro="Common problems and how to fix them — plus how to reach the team when you’re still stuck."
    />
  );
}
