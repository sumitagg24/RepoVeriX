'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Search,
  CornerDownLeft,
  LayoutDashboard,
  GitBranch,
  ScanSearch,
  Bug,
  GitPullRequest,
  Plus,
  BookOpen,
  CreditCard,
  Settings,
  GitCompare,
  Network,
  MessageSquare,
  Activity,
  History,
  FlaskConical,
  Loader2,
  FolderGit2,
} from 'lucide-react';
import { useRepositories } from '@/hooks/useRepositories';
import { useScans } from '@/hooks/useScans';
import type { Repository } from '@/types/api';

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: typeof Bug;
  keywords: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { data: repos, isLoading: reposLoading } = useRepositories();
  const { data: scans } = useScans();

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
        setQuery('');
        setIndex(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
  }, [open]);

  const go = (fn: () => void) => {
    onOpenChange(false);
    // Defer navigation until the overlay is dismissed so the route change is clean.
    window.setTimeout(fn, 30);
  };

  const actions = useMemo<PaletteAction[]>(() => {
    const latestScan = scans?.find((s) => s.status === 'completed');
    const page = (
      label: string,
      hint: string,
      href: string,
      icon: typeof Bug,
      keywords = ''
    ): PaletteAction => ({
      id: `page-${href}`,
      label,
      hint,
      group: 'Navigate',
      icon,
      keywords,
      run: () => go(() => router.push(href)),
    });

    const base: PaletteAction[] = [
      page('Dashboard', 'Audit posture at a glance', '/dashboard', LayoutDashboard, 'home overview health'),
      page('Repositories', 'Import or open a repository', '/repositories', GitBranch, 'github gitlab s3 zip archive'),
      page('Scans', 'All analysis runs', '/scans', ScanSearch, 'analysis pipeline runs'),
      page('Findings', 'Every evidence-backed issue', '/findings', Bug, 'vulnerabilities defects issues'),
      page('Pull Request Auditor', 'Analyze a GitHub PR', '/pull-requests', GitPullRequest, 'pr review audit'),
      page('Billing', 'Plans and usage', '/billing', CreditCard, 'plan upgrade stripe'),
      page('Settings', 'Account and connections', '/settings', Settings, 'profile keys oauth'),
      page('Documentation', 'Guides and API reference', '/docs', BookOpen, 'help guides'),
    ];

    const actionBase: PaletteAction[] = [
      {
        id: 'action-scan',
        label: 'Run a new scan',
        hint: latestScan ? 'Pick a repository and configuration' : 'Analyze a repository',
        group: 'Actions',
        icon: ScanSearch,
        keywords: 'start scan analysis run audit',
        run: () => go(() => router.push('/scans/new')),
      },
      {
        id: 'action-import',
        label: 'Import a repository',
        hint: 'GitHub · GitLab · archive URL · ZIP',
        group: 'Actions',
        icon: Plus,
        keywords: 'import connect add repo code',
        run: () => go(() => router.push('/repositories?import=1')),
      },
    ];

    const repoActions: PaletteAction[] = (repos ?? []).flatMap((repo: Repository) => [
      {
        id: `repo-${repo.id}`,
        label: repo.name,
        hint: `${repo.source_type.toUpperCase()} · open overview`,
        group: 'Repositories',
        icon: FolderGit2,
        keywords: `${repo.name} ${repo.source_type} ${(repo.primary_languages ?? []).join(' ')}`,
        run: () => go(() => router.push(`/repositories/${repo.id}`)),
      },
      ...REPO_TOOLS.map((t) => ({
        id: `repo-${repo.id}-${t.label}`,
        label: t.label,
        hint: repo.name,
        group: 'Repositories',
        icon: t.icon,
        keywords: `${repo.name} ${t.keywords}`,
        run: () => go(() => router.push(`/repositories/${repo.id}${t.href}`)),
      })),
    ]);

    return [...actionBase, ...base, ...repoActions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos, scans, router]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.keywords.toLowerCase().includes(q)
    );
  }, [actions, query]);

  // Keyboard navigation
  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const selected = el.querySelector<HTMLElement>(`[data-index="${index}"]`);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const groups: { name: string; items: PaletteAction[] }[] = [];
  for (const a of matches) {
    const last = groups[groups.length - 1];
    if (last && last.name === a.group) last.items.push(a);
    else groups.push({ name: a.group, items: [a] });
  }

  const choose = (i: number) => {
    const item = matches[i];
    if (item) item.run();
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-foreground/20 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border/70 px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, matches.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(index);
              }
            }}
            placeholder="Search repositories, findings, actions…"
            className="w-full bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {reposLoading && query === '' && matches.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Indexing repositories…
            </div>
          ) : groups.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No results for “{query}”. Try a repository name, feature or action.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-1">
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                  {g.name}
                </p>
                {g.items.map((a) => {
                  const idx = matches.indexOf(a);
                  const active = idx === index;
                  return (
                    <button
                      key={a.id}
                      data-index={idx}
                      onMouseEnter={() => setIndex(idx)}
                      onClick={() => choose(idx)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                        active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'
                      )}
                    >
                      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                        <a.icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate font-medium', active ? 'text-foreground' : 'text-foreground/90')}>
                          {a.label}
                        </span>
                        {a.hint && <span className="block truncate text-xs text-muted-foreground">{a.hint}</span>}
                      </span>
                      {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border/70 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 font-mono">↵</kbd> open
          </span>
          <span className="ml-auto hidden sm:block">
            Findings, PRs, attack paths and repairs are one jump away.
          </span>
        </div>
      </div>
    </div>
  );
}

const REPO_TOOLS: { label: string; href: string; icon: typeof Bug; keywords: string }[] = [
  { label: 'Audit', href: '/audit', icon: GitCompare, keywords: 'change impact risk attack paths dependencies' },
  { label: 'Evidence graph', href: '/graph', icon: Network, keywords: 'graph symbols callers' },
  { label: 'Ask RepoVeriX', href: '/intelligence?tab=ask', icon: MessageSquare, keywords: 'ask question chat assistant' },
  { label: 'Health history', href: '/history', icon: Activity, keywords: 'health timeline history' },
  { label: 'Regressions', href: '/regression', icon: History, keywords: 'compare scans resolved new' },
  { label: 'Research', href: '/research', icon: FlaskConical, keywords: 'multi-agent benchmark experiments' },
];
