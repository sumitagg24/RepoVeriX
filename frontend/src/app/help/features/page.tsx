import type { Metadata } from 'next';
import { CategoryView } from '@/components/help/category-view';

export const metadata: Metadata = {
  title: 'Features and analyses',
};

export default function HelpFeaturesPage() {
  return (
    <CategoryView
      categoryId="features"
      intro="Every analysis engine, what it detects, and the evidence it uses — from code health to verified repair."
    />
  );
}
