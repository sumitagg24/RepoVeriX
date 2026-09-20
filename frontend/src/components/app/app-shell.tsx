'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SessionExpiredState } from '@/components/ui/states';
import { Tooltip } from '@/components/ui/tooltip';
import { Wordmark } from '@/components/layout/logo';
import { CommandPalette } from '@/components/app/command-palette';
import { UserMenu } from '@/components/app/user-menu';
import { WorkspaceProvider, WorkspaceSwitcher } from '@/components/app/workspace-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { NAV_GROUPS } from '@/components/app/nav-model';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const SIDEBAR_KEY = 'repoverix.sidebar-collapsed';

/**
 * Workspace chrome.
 *
 * The shell owns four states a product this size is tempted to skip: the session
 * still loading, the session expired, an unverified account (the API gates
 * repository and scan writes on it), and the normal case. Everything else in the
 * workspace renders inside it.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <AppShellInner>{children}</AppShellInner>
    </WorkspaceProvider>
  );
}

/**
 * Read one query flag after mount.
 *
 * `useSearchParams()` in the shell would opt every workspace route out of
 * static prerendering and demand a Suspense boundary on each page. The shell
 * only needs a yes/no flag for a banner, so it reads the query string once on
 * the client and the routes stay prerenderable.
 */
function useQueryFlag(name: string): string | null {
  const [value, setValue] = React.useState<string | null>(null);
  React.useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading, sessionExpired } = useAuth();  const pathname = usePathname();
  const router = useRouter();
  const verifiedFlag = useQueryFlag('verified');

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);

  React.useEffect(() => {
    if (!loading && !user) {
      const next = encodeURIComponent(pathname || '/dashboard');
      router.replace(sessionExpired ? `/auth/sign-in?expired=1&next=${next}` : `/auth/sign-in?next=${next}`);
    }
  }, [loading, user, sessionExpired, router, pathname]);

  const toggleSidebar = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh">
        <div className="hidden w-60 shrink-0 border-r border-hairline lg:block" />
        <div className="flex-1">
          <div className="h-14 border-b border-hairline" />
          <div className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8">
            <span className="skeleton block h-7 w-56" />
            <span className="skeleton mt-3 block h-4 w-80" />
            <span className="skeleton mt-8 block h-40 w-full" />
          </div>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          Loading your workspace
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-5">
        <SessionExpiredState className="w-full" />
      </div>
    );
  }

  const unverified = verifiedFlag !== '1' && user.email_verified === false;

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar: persistent above lg, a drawer below it. */}
      <Sidebar collapsed={collapsed} className="hidden lg:flex" />

      <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-950/45 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-hairline bg-canvas lg:hidden">
            <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
              <DialogPrimitive.Title className="sr-only">Workspace navigation</DialogPrimitive.Title>
              <Wordmark />
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close navigation">
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <NavList onNavigate={() => setMobileNavOpen(false)} className="flex-1 overflow-y-auto px-3 py-4" />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-canvas/90 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-4.5" aria-hidden="true" />
          </Button>
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-4" aria-hidden="true" />
              )}
            </Button>
          </Tooltip>

          <WorkspaceSwitcher />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto hidden h-9 min-w-64 items-center gap-2 rounded-md border border-hairline bg-card px-3 text-left text-[13px] text-muted transition-colors hover:border-hairline-strong sm:flex lg:min-w-80"
          >
            <Search className="size-3.5" aria-hidden="true" />
            <span>Search repositories, findings, pages</span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto sm:hidden"
            aria-label="Search"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="size-4" aria-hidden="true" />
          </Button>

          <ThemeToggle />
          <UserMenu />
        </header>

        {unverified ? (
          <div className="border-b border-medium-line bg-medium-soft px-4 py-2.5 sm:px-6">
            <p className="text-[13px] text-ink">
              <span className="font-medium">Verify your email to unlock imports and scans.</span>{' '}
              <span className="text-body">
                The API keeps write actions closed until the verification link is opened.
              </span>{' '}
              <Link href="/settings/security" className="text-accent underline-offset-4 hover:underline">
                Open security settings
              </Link>
            </p>
          </div>
        ) : null}

        <main id="main" className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}

function NavList({
  onNavigate,
  className,
  collapsed = false,
}: {
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Workspace" className={className}>
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="mb-5 last:mb-0">
          {!collapsed ? <p className="px-2 pb-1.5 text-[11.5px] font-medium text-faint">{group.label}</p> : null}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-md py-2 text-[13.5px] transition-colors duration-150',
                      collapsed ? 'justify-center px-2' : 'px-2.5',
                      active ? 'bg-surface font-medium text-ink' : 'text-body hover:bg-surface/70 hover:text-ink',
                    )}
                  >
                    {active ? (
                      <span
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                    ) : null}
                    <Icon className={cn('size-4 shrink-0', active ? 'text-accent' : 'text-faint')} aria-hidden="true" />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Sidebar({ collapsed, className }: { collapsed: boolean; className?: string }) {
  return (
    <aside
      className={cn(
        'sticky top-0 h-dvh shrink-0 flex-col border-r border-hairline bg-canvas transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60',
        className,
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-hairline', collapsed ? 'justify-center' : 'px-4')}>
        <Wordmark showMark label="RepoVeriX workspace" />
      </div>
      <NavList collapsed={collapsed} className={cn('flex-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3')} />
      <div className={cn('border-t border-hairline py-3', collapsed ? 'px-2' : 'px-3')}>
        <p className={cn('text-[11.5px] leading-relaxed text-faint', collapsed && 'sr-only')}>
          Findings are analysis output, not a guarantee. Each one states its confidence and what was
          actually executed.
        </p>
      </div>
    </aside>
  );
}

/** Semantic page wrapper: every workspace route renders inside this. */
export function AppPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}
