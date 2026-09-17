import Link from 'next/link';
import { ArrowRight, FileText, Sparkles } from 'lucide-react';
import { HelpBreadcrumb } from '@/components/help/breadcrumb';
import { HELP_CATEGORIES } from '@/components/help/data';

export function CategoryView({
  categoryId,
  intro,
}: {
  categoryId: string;
  intro: string;
}) {
  const category = HELP_CATEGORIES.find((c) => c.id === categoryId);
  if (!category) return null;
  const Icon = category.icon;

  return (
    <div className="mx-auto max-w-4xl">
      <HelpBreadcrumb category={category.label} />
      <div className="mt-6 flex items-start gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {category.label}
          </h1>
          <p className="mt-1.5 text-muted-foreground">{intro}</p>
        </div>
      </div>

      <div className="mt-10 space-y-3">
        {category.articles.map((article) => (
          <Link
            key={`${article.title}-${article.href}`}
            href={article.href}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium transition-colors group-hover:text-primary">{article.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{article.blurb}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ))}
      </div>

      <div className="mt-10 flex items-start gap-3 rounded-2xl border bg-card/60 p-5 text-sm">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="leading-relaxed text-muted-foreground">
          Not the topic you needed?{' '}
          <Link href="/help" className="font-medium text-primary hover:underline">
            Browse all categories
          </Link>{' '}
          or{' '}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            contact us
          </Link>{' '}
          — include your repository or scan id and we’ll dig in.
        </p>
      </div>
    </div>
  );
}
