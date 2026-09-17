import Link from 'next/link';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/logo';
import { SearchX, ArrowLeft, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Page not found - RepoVeriX',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <LogoMark className="h-10 w-10" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        404
      </p>
      <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-semibold">
        <SearchX className="h-6 w-6 text-primary" aria-hidden />
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has moved. If you followed a
        shared report link, it may have been revoked or expired by its owner.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Back to home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs">
            <BookOpen className="mr-2 h-4 w-4" aria-hidden />
            Read the docs
          </Link>
        </Button>
      </div>
    </main>
  );
}
