"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  FileSearch,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  ScanSearch,
  FolderGit2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/scans", label: "Scans", icon: ScanSearch },
  { href: "/findings", label: "Findings", icon: FileSearch },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="pulse-soft inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          Loading your workspace…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-extrabold tracking-tight">RepoVeriX</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active =
                pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-black text-white dark:bg-white dark:text-black"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="hidden max-w-[200px] truncate text-sm font-medium text-muted-foreground sm:block">
              {user?.email ?? ""}
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">
              {(user?.full_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden scrollbar-hide">
          {NAV.map((n) => {
            const active =
              pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold",
                  active ? "bg-black text-white" : "text-muted-foreground",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="animate-page mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        {user && !user.email_verified && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/50 bg-amber-400/10 px-5 py-3.5 text-sm">
            <span className="font-bold">Email not verified.</span>
            <span className="text-muted-foreground">
              Repositories and scans stay locked until you confirm your mailbox.
            </span>
            <Link
              href={`/auth/verify-email?email=${encodeURIComponent(user.email)}`}
              className="ml-auto font-bold text-primary hover:underline"
            >
              Verify now →
            </Link>
          </div>
        )}
        {children}
      </main>
      <p className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 pb-8 text-[13px] text-muted-foreground sm:px-6">
        <FlaskConical className="h-3.5 w-3.5" />
        Verification runs in Docker — patches stay CANDIDATE until execution proves them.
      </p>
    </div>
  );
}
