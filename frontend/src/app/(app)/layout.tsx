'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  GitBranch,
  ScanSearch,
  Bug,
  GitPullRequest,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Plus,
  CreditCard,
  BookOpen,
  Search,
  PanelLeftClose,
  PanelLeft,
  Check,
  ShieldAlert,
  FileSearch,
  Network,
  GitCompare,
  MessageSquare,
  History,
  Activity,
  FlaskConical,
  Users,
  ShieldCheck,
  Loader2,
  LifeBuoy,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo, LogoMark } from '@/components/logo';
import { UpgradeToastListener } from '@/components/upgrade-toast';
import { CommandPalette } from '@/components/app/command-palette';
import { useAuth } from '@/context/AuthContext';
import { useDashboardSummary } from '@/hooks/useDashboard';
import { useRepositories } from '@/hooks/useRepositories';
import type { PlanName, Repository } from '@/types/api';

type NavItem = { name: string; href: string; icon: typeof Bug; exact?: boolean };

const nav: { section: string; items: NavItem[] }[] = [
  {
    section: 'Workspace',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Repositories', href: '/repositories', icon: GitBranch },
    ],
  },
  {
    section: 'Analysis',
    items: [
      { name: 'Scans', href: '/scans', icon: ScanSearch },
      { name: 'Findings', href: '/findings', icon: Bug },
    ],
  },
  {
    section: 'Review',
    items: [{ name: 'Pull Requests', href: '/pull-requests', icon: GitPullRequest }],
  },
  {
    section: 'Team',
    items: [
      { name: 'Team & Orgs', href: '/team', icon: Users },
      { name: 'Security Center', href: '/team/security', icon: ShieldCheck },
    ],
  },
  {
    section: 'System',
    items: [
      { name: 'Billing', href: '/billing', icon: CreditCard },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const REPO_VIEWS: { name: string; href: string; icon: typeof Bug }[] = [
  { name: 'Overview', href: '', icon: LayoutDashboard },
  { name: 'Audit', href: '/audit', icon: GitCompare },
  { name: 'Evidence graph', href: '/graph', icon: Network },
  { name: 'Ask RepoVeriX', href: '/intelligence?tab=ask', icon: MessageSquare },
  { name: 'Health history', href: '/history', icon: Activity },
  { name: 'Regression', href: '/regression', icon: History },
  { name: 'Research', href: '/research', icon: FlaskConical },
];

const PLAN_LABELS: Record<PlanName, string> = { free: 'Free', pro: 'Pro', team: 'Team' };
const REPO_STATUS_DOT: Record<string, string> = {
  active: 'bg-emerald-500',
  ingested: 'bg-emerald-500',
  registered: 'bg-sky-500',
  archived: 'bg-muted-foreground/60',
};

function repoDot(status: string) {
  return REPO_STATUS_DOT[status] || 'bg-muted-foreground/60';
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { data: repos } = useRepositories();
  const { data: summary } = useDashboardSummary();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Restore the sidebar preference; default to expanded on desktop.
  useEffect(() => {
    const saved = window.localStorage.getItem('repoverix-sidebar');
    if (saved === 'collapsed') setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/auth/login');
  }, [isLoading, user, router]);

  const persistCollapsed = (value: boolean) => {
    setCollapsed(value);
    window.localStorage.setItem('repoverix-sidebar', value ? 'collapsed' : 'expanded');
  };

  // Repo-scoped path (/repositories/:id/...)
  const repoMatch = pathname.match(/^\/repositories\/([0-9a-f-]+)/);
  const activeRepoId = repoMatch?.[1] ?? null;
  const activeRepo = repos?.find((r) => r.id === activeRepoId) ?? null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  const findingTotal = summary?.findings.total ?? null;
  const criticalTotal = summary?.findings.by_severity.critical ?? 0;

  const navigateRepo = (id: string) => {
    setSidebarOpen(false);
    router.push(`/repositories/${id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Keyboard a11y: jump straight to content, past the sidebar + header. */}
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <UpgradeToastListener />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[76px]' : 'w-[268px]'
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-16 items-center gap-2 border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            {collapsed ? <LogoMark className="h-7 w-7" /> : <Logo withTagline />}
          </Link>
          {!collapsed && user && (
            <Link
              href="/billing"
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
              title="Current plan — view billing"
            >
              {PLAN_LABELS[user.plan]}
            </Link>
          )}
          <button
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick action */}
        <div className={cn('pt-3', collapsed ? 'px-2' : 'px-3')}>
          <Link href="/repositories?import=1" onClick={() => setSidebarOpen(false)}>
            <Button
              className={cn('w-full gap-2 shadow-sm', collapsed && 'px-0')}
              size={collapsed ? 'icon' : 'default'}
              title="Import repository"
            >
              <Plus className="h-4 w-4" />
              {!collapsed && 'Import repository'}
            </Button>
          </Link>
        </div>
        {!collapsed && (
          <p className="mt-3 px-4 text-[11px] text-muted-foreground/70">
            Scans run in the background — you can keep working while a repository is being
            analyzed.
          </p>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-none lg:px-3">
          {nav.map((group) => (
            <div key={group.section} className="mb-3.5">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  const showBadge = item.href === '/findings' && findingTotal !== null && findingTotal > 0;
                  const link = (
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'group relative flex items-center rounded-lg text-[13px] font-medium transition-colors',
                        collapsed ? 'justify-center py-2.5' : 'gap-2.5 px-2.5 py-1.5',
                        active
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-sidebar-border'
                          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                      )}
                      title={collapsed ? item.name : undefined}
                    >
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                      )}
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
                      {!collapsed && showBadge && (
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                            item.href === '/findings' && criticalTotal > 0
                              ? 'bg-red-500/15 text-red-600'
                              : 'bg-muted text-muted-foreground'
                          )}
                          title={`${findingTotal} findings · ${criticalTotal} critical`}
                        >
                          {findingTotal}
                        </span>
                      )}
                    </Link>
                  );
                  return collapsed ? (
                    <span key={item.name} title={item.name}>{link}</span>
                  ) : (
                    link
                  );
                })}
              </div>
            </div>
          ))}

          {/* Security posture summary (sidebar footer block) */}
          {!collapsed && summary && (summary.findings.total ?? 0) > 0 && (
            <div className="mt-2 rounded-xl border border-border/70 bg-card/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                  Verified findings
                </span>
                <span className="font-mono font-semibold tabular-nums">{summary.findings.by_status.verified || 0}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Critical / High</span>
                <span className="font-mono font-semibold tabular-nums">
                  {criticalTotal} / {summary.findings.by_severity.high || 0}
                </span>
              </div>
            </div>
          )}
        </nav>

        {/* Docs + collapse */}
        <div className={cn('space-y-0.5 border-t border-sidebar-border p-2.5', collapsed && 'pb-4')}>
          <Link
            href="/docs"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
              collapsed ? 'justify-center py-2.5' : 'gap-2 px-2.5 py-1.5'
            )}
            title="Documentation"
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && 'Documentation'}
          </Link>
          {!collapsed && (
            <Link
              href="/help"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LifeBuoy className="h-3.5 w-3.5 shrink-0" />
              Help center
            </Link>
          )}
          <button
            onClick={() => persistCollapsed(!collapsed)}
            className={cn(
              'hidden w-full items-center rounded-xl text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground lg:flex',
              collapsed ? 'justify-center py-2.5' : 'gap-2 px-2.5 py-1.5'
            )}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Collapse sidebar'}
          </button>
        </div>
      </aside>

      {/* Mobile trigger */}
      <button
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border bg-background shadow-sm lg:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Content */}
      <main id="app-main" tabIndex={-1} className={cn('transition-[padding] duration-200 outline-none', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[268px]')}>
        <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 pb-16 pt-16 sm:px-6 lg:px-10 lg:pt-5">
          {/* Top action bar */}
          <header className="sticky top-3 z-30 mb-6 rounded-xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-md">
            <div className="flex h-12 items-center gap-1 px-2 sm:px-3">
              {/* Brand + workspace identity (reference-style left cluster) */}
              <WorkspaceIdentity user={user} collapsed={collapsed} />
              <span className="mx-0.5 hidden h-5 w-px bg-border lg:block" />

              {/* Repository selector (space switcher) */}
              <RepositorySelector
                repos={repos ?? []}
                loading={!repos}
                activeRepo={activeRepo}
                collapsed={collapsed}
                onNavigate={navigateRepo}
              />

              {/* Search / command palette (reference-style center) */}
              <button
                onClick={() => setPaletteOpen(true)}
                className="mx-1 hidden h-8 flex-1 items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 text-[13px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 sm:flex lg:max-w-md"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="flex-1 truncate text-left">
                  {activeRepo ? `Search ${activeRepo.name}…` : 'Search repositories, findings, actions…'}
                </span>
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </button>
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-muted/70 sm:hidden"
                aria-label="Command palette"
              >
                <Search className="h-4 w-4" />
              </button>

              {/* Right-side quick actions (reference-style) */}
              <div className="ml-auto flex items-center gap-1">
                <ThemeToggle className="border bg-card shadow-sm ring-1 ring-border hover:bg-card/80" />
                <Link href="/pull-requests">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground xl:inline-flex"
                  >
                    <GitPullRequest className="h-3.5 w-3.5" />
                    Pull requests
                  </Button>
                </Link>
                <Link href="/scans/new">
                  <Button size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-xs shadow-sm">
                    <ScanSearch className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New scan</span>
                  </Button>
                </Link>
              </div>

              {/* User (reference-style avatar block with presence dot) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative ml-0.5 flex items-center gap-1.5 rounded-lg p-1 pr-1.5 transition-colors hover:bg-accent">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                        {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    <span
                      className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border-2 border-card bg-emerald-500"
                      title="Online"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="truncate text-sm font-medium leading-tight">{user?.full_name}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
                    <Badge variant="outline" className="mt-1.5 px-1.5 py-0 text-[10px] capitalize">
                      {user ? PLAN_LABELS[user.plan] : ''} plan
                    </Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/billing">
                      <CreditCard className="mr-2 h-4 w-4" /> Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="mr-2 h-4 w-4" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/docs">
                      <BookOpen className="mr-2 h-4 w-4" /> Documentation
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Repo context strip (only when inside a repository) */}
          {activeRepo && !collapsed && <RepoContextBar repo={activeRepo} />}

          <div key={pathname} className="animate-page flex flex-col">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function RepositorySelector({
  repos,
  loading,
  activeRepo,
  collapsed,
  onNavigate,
}: {
  repos: Repository[];
  loading: boolean;
  activeRepo: Repository | null;
  collapsed: boolean;
  onNavigate: (id: string) => void;
}) {
  const router = useRouter();
  const currentName = activeRepo?.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-9 items-center gap-2 rounded-xl border border-transparent px-2.5 text-sm font-medium transition-colors hover:border-border/70 hover:bg-muted/50',
            collapsed && 'border-border/70 bg-muted/40 px-2'
          )}
          title={activeRepo ? `${currentName} — switch repository` : 'Switch repository'}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitBranch className="h-3.5 w-3.5" />
          </span>
          {!collapsed && (
            <>
              <span className="hidden max-w-[180px] truncate sm:block lg:max-w-[240px]">
                {activeRepo ? currentName : 'All workspaces'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {activeRepo && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              <span className="truncate font-semibold">{activeRepo.name}</span>
            </DropdownMenuLabel>
            <div className="px-2 pb-1">
              <div className="grid grid-cols-2 gap-0.5">
                {REPO_VIEWS.map((v) => (
                  <Link
                    key={v.name}
                    href={`/repositories/${activeRepo.id}${v.href}`}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <v.icon className="h-3.5 w-3.5" />
                    {v.name}
                  </Link>
                ))}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>All repositories</DropdownMenuLabel>
          </>
        )}
        {!activeRepo && <DropdownMenuLabel>Jump to a repository</DropdownMenuLabel>}
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : repos.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground">
              No repositories yet.{' '}
              <Link href="/repositories?import=1" className="font-medium text-primary hover:underline">
                Import one
              </Link>
            </div>
          ) : (
            repos.map((repo) => {
              const selected = repo.id === activeRepo?.id;
              return (
                <DropdownMenuItem key={repo.id} onSelect={() => onNavigate(repo.id)} className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', repoDot(repo.status))} />
                  <span className="min-w-0 flex-1 truncate">{repo.name}</span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  {!selected && (
                    <span className="shrink-0 text-[10px] uppercase text-muted-foreground/70">
                      {repo.source_type}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/repositories')}>
          <GitBranch className="mr-2 h-4 w-4" /> Manage repositories
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Reference-style left cluster: the RepoVeriX brand mark + a workspace
 * identity row. Tucked to a single mark in collapsed/desktop-constrained
 * widths (the mark always identifies the product).
 */
function WorkspaceIdentity({
  user,
  collapsed,
}: {
  user: { full_name?: string | null; email?: string | null } | null;
  collapsed: boolean;
}) {
  const router = useRouter();
  const firstName = user?.full_name?.split(' ')[0] || 'RepoVeriX';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent',
            collapsed && 'hidden'
          )}
          title={`${firstName}'s workspace`}
        >
          <LogoMark className="h-6 w-6" />
          <span className="hidden items-center gap-1 text-[13px] font-semibold lg:flex">
            {firstName}&apos;s workspace
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{firstName}&apos;s workspace</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user?.email}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
          <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/repositories')}>
          <GitBranch className="mr-2 h-4 w-4" /> All repositories
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/repositories?import=1')}>
          <Plus className="mr-2 h-4 w-4" /> Import repository
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/billing')}>
          <CreditCard className="mr-2 h-4 w-4" /> Billing &amp; plans
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" /> Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RepoContextBar({ repo }: { repo: Repository }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
      {REPO_VIEWS.map((v) => {
        const viewHref = `/repositories/${repo.id}${v.href}`;
        return (
          <Link
            key={v.name}
            href={viewHref}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground hover:shadow-sm"
          >
            <v.icon className="h-3.5 w-3.5" />
            {v.name}
          </Link>
        );
      })}
      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileSearch className="h-3.5 w-3.5" />
        {repo.primary_languages?.length ? repo.primary_languages.slice(0, 3).join(' · ') : repo.source_type}
      </span>
    </div>
  );
}
