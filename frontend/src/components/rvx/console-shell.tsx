'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Check,
  ChevronDown,
  Command,
  CreditCard,
  GitBranch,
  LifeBuoy,
  LogOut,
  Menu,
  Plus,
  ScanSearch,
  Search,
  Settings,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { LogoMark } from '@/components/logo';
import { UpgradeToastListener } from '@/components/upgrade-toast';
import { CommandPalette } from '@/components/app/command-palette';
import { useAuth } from '@/context/AuthContext';
import { useScans } from '@/hooks/useScans';
import type { Repository, DashboardSummary, PlanName } from '@/types/api';
import {
  GLOBAL_SECTIONS,
  MOBILE_ITEMS,
  RAIL_ITEMS,
  REPO_VIEWS,
  activeRepoIdFromPath,
  isActivePath,
  repoViewHref,
  type NavItem,
} from '@/components/rvx/nav-model';

/**
 * ConsoleShell — the RepoVeriX workspace chrome.
 *
 * This replaces the previous sidebar entirely. The model is:
 *
 *   telemetry bar    what am I looking at, and what is the platform doing now
 *   icon rail        the four surfaces of the daily loop, always reachable
 *   navigation panel the full map, opened on demand instead of always painted
 *   context strip    the repository's deep views, numbered, only when relevant
 *
 * The old 268px always-on sidebar spent a fifth of the viewport repeating
 * eleven labels. Here the labels live in a panel that opens when asked, and the
 * permanent chrome carries state instead: repository, scan activity, findings.
 */

const PLAN_LABELS: Record<PlanName, string> = { free: 'Free', pro: 'Pro', team: 'Team' };

type ShellUser = { full_name?: string | null; email?: string | null; plan: PlanName } | null;

export function ConsoleShell({
  user,
  repos,
  summary,
  children,
}: {
  user: ShellUser;
  repos: Repository[] | undefined;
  summary: DashboardSummary | undefined;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [panelOpen, setPanelOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { data: scansRaw } = useScans();
  // Every list-shaped payload is normalised once, here. A response that is not
  // an array must never be able to take the shell down.
  const scans = Array.isArray(scansRaw) ? scansRaw : [];
  const repoList = Array.isArray(repos) ? repos : [];

  const activeRepoId = activeRepoIdFromPath(pathname) ?? '';
  const activeRepo = repoList.find((r) => r.id === activeRepoId) ?? null;

  const running = scans.filter((s) => s.status === 'running').length;
  const queued = scans.filter((s) => s.status === 'pending').length;
  const findingsTotal = summary?.findings?.total ?? 0;
  const critical = summary?.findings?.by_severity?.critical ?? 0;
  const verified = summary?.findings?.by_status?.verified ?? 0;

  // Close the panel whenever the route changes — otherwise a tap on a nav item
  // leaves the sheet covering the page it just navigated to.
  useEffect(() => {
    setPanelOpen(false);
  }, [pathname]);

  return (
    <div className="rvx-canvas min-h-screen text-foreground">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <UpgradeToastListener />

      <TelemetryBar
        user={user}
        repos={repoList}
        activeRepo={activeRepo}
        telemetry={{ running, queued, findingsTotal, critical, verified }}
        onOpenPanel={() => setPanelOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <div className="flex">
        <IconRail pathname={pathname} repoId={activeRepoId} onOpenPanel={() => setPanelOpen(true)} />

        <div className="min-w-0 flex-1 lg:pl-14">
          {activeRepo && (
            <ContextStrip repo={activeRepo} pathname={pathname} />
          )}

          <main id="app-main" tabIndex={-1} className="outline-none">
            <div
              key={pathname}
              className="animate-page mx-auto w-full max-w-[1560px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-16"
            >
              {children}
            </div>
          </main>
        </div>
      </div>

      {panelOpen && (
        <NavigationPanel
          pathname={pathname}
          repo={activeRepo}
          critical={critical}
          findingsTotal={findingsTotal}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <MobileBar
        pathname={pathname}
        findingsTotal={findingsTotal}
        onOpenPanel={() => setPanelOpen(true)}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- telemetry */

function TelemetryBar({
  user,
  repos,
  activeRepo,
  telemetry,
  onOpenPanel,
  onOpenPalette,
}: {
  user: ShellUser;
  repos: Repository[];
  activeRepo: Repository | null;
  telemetry: { running: number; queued: number; findingsTotal: number; critical: number; verified: number };
  onOpenPanel: () => void;
  onOpenPalette: () => void;
}) {
  const router = useRouter();
  const firstName = user?.full_name?.split(' ')[0] || 'Workspace';

  return (
    <header className="sticky top-0 z-40 border-b bg-[hsl(var(--rvx-surface)/0.88)] backdrop-blur-md rvx-hairline">
      <div className="flex h-12 items-center gap-2 px-2 sm:px-3">
        <button
          onClick={onOpenPanel}
          className="rvx-rail-item h-8 w-8 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link href="/dashboard" className="flex items-center gap-2 px-1" aria-label="RepoVeriX home">
          <LogoMark className="h-5 w-5" />
          <span className="hidden text-[13px] font-semibold tracking-tight sm:inline">
            RepoVeri<span className="text-[hsl(var(--rvx-source))]">X</span>
          </span>
        </Link>

        <span aria-hidden="true" className="mx-1 hidden h-4 w-px bg-border/60 lg:block" />

        {/* Repository in context — the primary mode switch of the console. */}
        <RepositorySwitcher repos={repos} activeRepo={activeRepo} />

        {/* Live telemetry. Real counts only; nothing here is decorative. */}
        <div className="ml-1 hidden items-center gap-3 xl:flex">
          {(telemetry.running > 0 || telemetry.queued > 0) && (
            <span className="rvx-mono flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--rvx-source))]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
              {telemetry.running} running
              {telemetry.queued > 0 && <span className="text-muted-foreground">· {telemetry.queued} queued</span>}
            </span>
          )}
          <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            findings <span className="text-foreground">{telemetry.findingsTotal}</span>
            {telemetry.critical > 0 && (
              <span className="text-[hsl(var(--sev-critical))]"> · {telemetry.critical} crit</span>
            )}
          </span>
          <span className="rvx-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            verified <span className="text-[hsl(var(--rvx-verified))]">{telemetry.verified}</span>
          </span>
        </div>

        <button
          onClick={onOpenPalette}
          className="ml-auto hidden h-8 max-w-[320px] flex-1 items-center gap-2 rounded-[var(--radius-md)] border px-2.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground rvx-hairline md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate text-left">
            {activeRepo ? `Search ${activeRepo.name}…` : 'Search findings, repositories, actions…'}
          </span>
          <kbd className="rvx-mono flex items-center gap-0.5 rounded-[3px] border px-1 py-0.5 text-[9px] rvx-hairline">
            <Command className="h-2.5 w-2.5" aria-hidden="true" />K
          </kbd>
        </button>

        <button
          onClick={onOpenPalette}
          className="rvx-rail-item ml-auto h-8 w-8 md:hidden"
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          <ThemeToggle className="h-8 w-8 border-0 bg-transparent shadow-none ring-0 hover:bg-accent" />
          <Link href="/scans/new">
            <Button size="sm" className="h-8 gap-1.5 rounded-[var(--radius-md)] px-2.5 text-xs">
              <ScanSearch className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Analyze</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-0.5 flex items-center gap-1.5 rounded-[var(--radius-md)] p-1 transition-colors hover:bg-accent">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-accent text-[10px] font-semibold">
                    {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:block" />
                <span className="sr-only">Account menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-medium leading-tight">{user?.full_name}</p>
                <p className="truncate text-[11px] font-normal text-muted-foreground">{user?.email}</p>
                <p className="rvx-mono mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {firstName} · {user ? PLAN_LABELS[user.plan] : ''}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/billing">
                  <CreditCard className="mr-2 h-4 w-4" /> Plan &amp; usage
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/docs">
                  <BookOpen className="mr-2 h-4 w-4" /> Documentation
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">
                  <LifeBuoy className="mr-2 h-4 w-4" /> Help
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AccountLogout />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function AccountLogout() {
  const { logout } = useAuth();
  return (
    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => logout()}>
      <LogOut className="mr-2 h-4 w-4" /> Log out
    </DropdownMenuItem>
  );
}

/* --------------------------------------------------------------- repo switch */

function RepositorySwitcher({
  repos,
  activeRepo,
}: {
  repos: Repository[];
  activeRepo: Repository | null;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-8 min-w-0 items-center gap-2 rounded-[var(--radius-md)] px-2 text-[13px] font-medium transition-colors hover:bg-accent"
          title={activeRepo ? `${activeRepo.name} — switch repository` : 'Switch repository'}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="max-w-[9rem] truncate sm:max-w-[14rem]">
            {activeRepo ? activeRepo.name : 'All repositories'}
          </span>
          {activeRepo && (
            <span className="rvx-mono hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
              {activeRepo.source_type}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="rvx-mono text-[10px] uppercase tracking-wider">
          Repositories
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[60vh] overflow-y-auto">
          {repos.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No repositories imported yet.
            </p>
          ) : (
            repos.map((repo) => {
              const selected = repo.id === activeRepo?.id;
              return (
                <DropdownMenuItem
                  key={repo.id}
                  onSelect={() => router.push(`/repositories/${repo.id}`)}
                  className="flex items-center gap-2"
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      repo.status === 'active' || repo.status === 'ingested'
                        ? 'bg-[hsl(var(--rvx-verified))]'
                        : 'bg-muted-foreground/50'
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{repo.name}</span>
                  {selected ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--rvx-source))]" />
                  ) : (
                    <span className="rvx-mono shrink-0 text-[10px] uppercase text-muted-foreground/70">
                      {repo.status}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/repositories?import=1">
            <Plus className="mr-2 h-4 w-4" /> Import a repository
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/repositories">
            <GitBranch className="mr-2 h-4 w-4" /> All repositories
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------- rail */

function IconRail({
  pathname,
  repoId,
  onOpenPanel,
}: {
  pathname: string;
  repoId: string;
  onOpenPanel: () => void;
}) {
  return (
    <nav
      aria-label="Console rail"
      className="fixed inset-y-0 left-0 top-12 z-30 hidden w-14 flex-col items-center border-r bg-[hsl(var(--rvx-surface)/0.6)] py-3 rvx-hairline lg:flex"
    >
      <div className="flex flex-col items-center gap-1">
        {RAIL_ITEMS.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              className="rvx-rail-item group"
              title={item.name}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              <span className="sr-only">{item.name}</span>
              <RailTooltip label={item.name} />
            </Link>
          );
        })}
      </div>

      <button onClick={onOpenPanel} className="rvx-rail-item mt-1" title="All navigation">
        <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        <span className="sr-only">All navigation</span>
        <RailTooltip label="All navigation" />
      </button>

      <span aria-hidden="true" className="my-2 h-px w-6 bg-border/50" />

      {repoId && (
        <div className="flex flex-col items-center gap-1">
          {REPO_VIEWS.slice(0, 4).map((view) => {
            const href = repoViewHref(repoId, view);
            const active = isActivePath(pathname, href);
            const Icon = view.icon;
            return (
              <Link
                key={view.name}
                href={href}
                data-active={active}
                aria-current={active ? 'page' : undefined}
                className="rvx-rail-item group"
                title={view.name}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                <span className="sr-only">{view.name}</span>
                <RailTooltip label={view.name} />
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-auto flex flex-col items-center gap-1">
        <Link href="/docs" className="rvx-rail-item group" title="Documentation">
          <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="sr-only">Documentation</span>
          <RailTooltip label="Documentation" />
        </Link>
        <Link href="/help" className="rvx-rail-item group" title="Help">
          <LifeBuoy className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="sr-only">Help</span>
          <RailTooltip label="Help" />
        </Link>
        <Link href="/settings" className="rvx-rail-item group" title="Settings">
          <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="sr-only">Settings</span>
          <RailTooltip label="Settings" />
        </Link>
      </div>
    </nav>
  );
}

/** Rail labels are revealed on hover/focus rather than permanently painted. */
function RailTooltip({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-[var(--radius-sm)] border px-2 py-1 text-[11px] font-medium shadow-none rvx-hairline',
        'bg-[hsl(var(--rvx-surface-2))] text-foreground group-hover:block group-focus-visible:block'
      )}
    >
      {label}
    </span>
  );
}

/* ----------------------------------------------------------- context strip */

function ContextStrip({ repo, pathname }: { repo: Repository; pathname: string }) {
  const repoBase = `/repositories/${repo.id}`;
  return (
    <div className="sticky top-12 z-30 border-b bg-[hsl(var(--rvx-canvas)/0.92)] backdrop-blur-md rvx-hairline">
      <div className="flex items-center gap-2 px-2 sm:px-3">
        <div className="rvx-tabstrip min-w-0 flex-1">
          {REPO_VIEWS.map((view, index) => {
            const href = repoViewHref(repo.id, view);
            const active =
              view.href === ''
                ? pathname === repoBase
                : isActivePath(pathname, href, false);
            const Icon = view.icon;
            return (
              <Link
                key={view.name}
                href={href}
                data-active={active}
                aria-current={active ? 'page' : undefined}
                className="rvx-tab"
              >
                <span className="rvx-mono text-[9px] text-muted-foreground/70">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {view.name}
              </Link>
            );
          })}
        </div>
        <span className="rvx-mono hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground xl:block">
          {repo.primary_languages?.length
            ? repo.primary_languages.slice(0, 3).join(' · ')
            : repo.source_type}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ nav panel */

function NavigationPanel({
  pathname,
  repo,
  findingsTotal,
  critical,
  onClose,
}: {
  pathname: string;
  repo: Repository | null;
  findingsTotal: number;
  critical: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sections = useMemo(() => GLOBAL_SECTIONS, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className="fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col border-r bg-[hsl(var(--rvx-surface))] rvx-hairline"
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-3 rvx-hairline">
          <span className="rvx-eyebrow">Navigate</span>
          <button onClick={onClose} className="rvx-rail-item h-7 w-7" aria-label="Close navigation">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {repo && (
            <div className="mb-4">
              <p className="rvx-eyebrow px-2 pb-1.5">
                Repository · <span className="text-foreground/80">{repo.name}</span>
              </p>
              <div className="space-y-px">
                {REPO_VIEWS.map((view) => {
                  const href = repoViewHref(repo.id, view);
                  const active = isActivePath(pathname, href);
                  const Icon = view.icon;
                  return (
                    <Link
                      key={view.name}
                      href={href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-accent font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{view.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {sections.map((section) => (
            <div key={section.section} className="mb-4">
              <p className="rvx-eyebrow px-2 pb-1.5">{section.section}</p>
              <div className="space-y-px">
                {section.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  const badge = item.href === '/findings' && findingsTotal > 0 ? findingsTotal : null;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] transition-colors',
                        active
                          ? 'bg-accent font-medium text-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      {badge !== null && (
                        <span
                          className={cn(
                            'rvx-mono rounded-[4px] px-1.5 py-0.5 text-[10px]',
                            critical > 0
                              ? 'bg-[hsl(var(--sev-critical)/0.14)] text-[hsl(var(--sev-critical))]'
                              : 'text-muted-foreground'
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t p-3 rvx-hairline">
          <Link
            href="/repositories?import=1"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Import a repository
          </Link>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Analysis runs server-side — you can keep working while a repository is analysed.
          </p>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- mobile bar */

function MobileBar({
  pathname,
  findingsTotal,
  onOpenPanel,
}: {
  pathname: string;
  findingsTotal: number;
  onOpenPanel: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-[hsl(var(--rvx-surface)/0.96)] pb-[env(safe-area-inset-bottom)] backdrop-blur-md rvx-hairline lg:hidden"
    >
      <div className="grid grid-cols-5">
        {MOBILE_ITEMS.map((item: NavItem) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[2px] w-8 rounded-full bg-primary"
                />
              )}
              <span className="relative">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {item.href === '/findings' && findingsTotal > 0 && (
                  <span className="rvx-mono absolute -right-2.5 -top-1.5 min-w-[15px] rounded-full bg-[hsl(var(--sev-critical))] px-1 text-center text-[9px] font-bold leading-[15px] text-white">
                    {findingsTotal > 99 ? '99+' : findingsTotal}
                  </span>
                )}
              </span>
              {item.short}
            </Link>
          );
        })}
        <button
          onClick={onOpenPanel}
          className="relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
          More
        </button>
      </div>
    </nav>
  );
}
