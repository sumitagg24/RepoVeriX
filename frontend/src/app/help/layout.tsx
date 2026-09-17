import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="RepoVeriX home" className="flex items-center gap-2">
            <Logo />
          </Link>
          <div className="flex items-center gap-1 text-sm">
            <Link
              href="/docs"
              className="hidden rounded-lg px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:block"
            >
              Docs
            </Link>
            <Link href="/help" className="rounded-lg px-3 py-2 font-medium text-foreground">
              Help
            </Link>
            <Link
              href="/contact"
              className="hidden rounded-lg px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:block"
            >
              Contact
            </Link>
          </div>
        </div>
      </nav>
      {children}
    </main>
  );
}
