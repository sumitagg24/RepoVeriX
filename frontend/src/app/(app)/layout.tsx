'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  GitBranch,
  ScanSearch,
  Bug,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';
import { useAuth } from '@/context/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Repositories', href: '/repositories', icon: GitBranch },
  { name: 'Scans', href: '/scans', icon: ScanSearch },
  { name: 'Findings', href: '/findings', icon: Bug },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authenticated area: bounce to the sign-in page while we learn who we are.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, user, router]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-background">
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
          'fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-sidebar border-r border-sidebar-border transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarOpen(false)}>
            <Logo withTagline />
          </Link>
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="px-4 pt-2 pb-4">
          <Link href="/repositories?import=1" onClick={() => setSidebarOpen(false)}>
            <Button className="w-full justify-start gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Import repository
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Workspace
          </p>
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-card text-foreground shadow-sm ring-1 ring-sidebar-border'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <item.icon
                    className={cn('h-[18px] w-[18px]', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Theme + user */}
        <div className="p-3 pb-2 border-t border-sidebar-border">
          <div className="flex items-center justify-between rounded-xl px-2.5 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
        <div className="px-3 pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl bg-card p-2.5 text-left shadow-sm ring-1 ring-sidebar-border transition-colors hover:bg-card/70">
                <Avatar className="h-8 w-8">
                  {user?.email ? (
                    <AvatarImage
                      src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.email)}&backgroundColor=ffd9c8`}
                      alt={user?.full_name || ''}
                    />
                  ) : null}
                  <AvatarFallback>{user?.full_name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-tight">{user?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[240px]" align="start" forceMount>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile trigger */}
      <button
        className="fixed left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-xl border bg-background shadow-sm lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Content */}
      <main className="lg:pl-[264px]">
        <div
          key={pathname}
          className="animate-page mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-10 lg:py-10"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
