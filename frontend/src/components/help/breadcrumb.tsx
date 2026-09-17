import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

/** Breadcrumb row used at the top of help category / contact / community pages. */
export function HelpBreadcrumb({ category }: { category: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/help" className="transition-colors hover:text-foreground">
        Help center
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="font-medium text-foreground">{category}</span>
    </nav>
  );
}
