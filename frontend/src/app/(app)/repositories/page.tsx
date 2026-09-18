'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RepositoryImportDialog } from '@/components/import-repository';
import { useRepositories, useDeleteRepository } from '@/hooks/useRepositories';
import {
  GitBranch,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  ExternalLink,
  Loader2,
  FolderGit2,
  Github,
  Gitlab,
  UploadCloud,
  Cloud,
  ScanSearch,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Repository, SourceType } from '@/types/api';
import { EmptyState, ListSkeleton } from '@/components/ui/state';
import { cn } from '@/lib/utils';

const SOURCE_META: Record<SourceType, { label: string; icon: typeof Github; className: string }> = {
  github: { label: 'GitHub', icon: Github, className: 'bg-foreground/10 text-foreground' },
  gitlab: { label: 'GitLab', icon: Gitlab, className: 'bg-[#E24329]/10 text-[#E24329]' },
  git: { label: 'Git', icon: GitBranch, className: 'bg-primary/10 text-primary' },
  archive: { label: 'Archive', icon: Cloud, className: 'chip-outline' },
  zip: { label: 'ZIP', icon: UploadCloud, className: 'bg-primary/10 text-primary' },
};

function SourceIcon({ source }: { source: SourceType }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <span className={`flex h-8 w-8 items-center justify-center rounded-md ${meta.className}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function RepositoriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: repositories, isLoading } = useRepositories();
  const deleteMutation = useDeleteRepository();
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'github' | 'gitlab' | 's3' | 'zip' | 'git'>('github');

  const wantImport = searchParams.get('import') === '1';
  const tabParam = searchParams.get('tab') as 'github' | 'gitlab' | 's3' | 'zip' | 'git' | null;
  const handledImportParam = useRef(false);

  useEffect(() => {
    if (wantImport && !handledImportParam.current) {
      handledImportParam.current = true;
      if (tabParam) setInitialTab(tabParam);
      setDialogOpen(true);
      router.replace('/repositories');
    }
  }, [wantImport, tabParam, router]);

  const openImport = (tab: 'github' | 'gitlab' | 's3' | 'zip' | 'git' = 'github') => {
    setInitialTab(tab);
    setDialogOpen(true);
    router.replace('/repositories');
  };

  const filtered =
    repositories?.filter((r) => r.name.toLowerCase().includes(searchQuery.toLowerCase())) ?? [];

  const handleDelete = async (repo: Repository) => {
    if (!window.confirm(`Delete "${repo.name}" and all its scans? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(repo.id);
      toast.success('Repository deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="rvx-eyebrow">Repositories</p>
          <h1 className="rvx-title mt-2 text-2xl sm:text-3xl">Auditable code</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {filtered.length} repositor{filtered.length === 1 ? 'y' : 'ies'} ready to scan
          </p>
        </div>
        <Button onClick={() => openImport('github')} className="gap-2">
          <Plus className="h-4 w-4" />
          Import
        </Button>
      </header>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search repositories…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-lg bg-muted/40 border border-border/60"
        />
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card/30">
          <EmptyState
            icon={searchQuery ? Search : FolderGit2}
            title={searchQuery ? `No repositories match "${searchQuery}"` : 'No repositories'}
            body={
              searchQuery
                ? 'Try a different search.'
                : 'Import a repository from GitHub, GitLab, an archive, or a ZIP file to get started.'
            }
            action={
              searchQuery ? (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => openImport('github')} className="gap-2">
                  <Plus className="h-4 w-4" /> Import repository
                </Button>
              )
            }
          />
        </div>
      ) : (
        /* Dense table-like list */
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card/40">
          <div className="divide-y divide-border/60">
            {/* Header row */}
            <div className="hidden grid-cols-12 gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <div className="col-span-4">Repository</div>
              <div className="col-span-2">Languages</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            <div className="hidden md:block border-t border-border/60" />

            {/* Data rows */}
            {filtered.map((repo) => {
              const meta = SOURCE_META[repo.source_type];
              const isActive = repo.status === 'active' || repo.status === 'ingested';
              return (
                <Link
                  key={repo.id}
                  href={`/repositories/${repo.id}`}
                  className="data-row grid grid-cols-1 gap-3 px-4 py-3 transition-colors hover:bg-accent/30 md:grid-cols-12"
                >
                  {/* Mobile: stacked layout */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-start gap-3">
                      <SourceIcon source={repo.source_type} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate hover:text-primary">{repo.name}</p>
                        <p className="text-xs text-muted-foreground">{meta.label}</p>
                      </div>
                    </div>
                    {repo.primary_languages && repo.primary_languages.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {repo.primary_languages.slice(0, 3).map((lang) => (
                          <span key={lang} className="text-[10px] px-2 py-0.5 rounded bg-muted/60 text-muted-foreground capitalize">
                            {lang}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      <span className={cn('inline-block px-2 py-1 rounded-md text-[10px] font-semibold capitalize', isActive ? 'state-verified-soft' : 'chip-outline')}>
                        {repo.status}
                      </span>
                    </div>
                  </div>

                  {/* Desktop: table rows */}
                  <div className="hidden md:col-span-4 md:flex md:items-center md:gap-2">
                    <SourceIcon source={repo.source_type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate hover:text-primary">{repo.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{repo.default_branch}</p>
                    </div>
                  </div>

                  <div className="hidden md:col-span-2 md:flex md:items-center md:gap-1 md:flex-wrap">
                    {repo.primary_languages && repo.primary_languages.length > 0 ? (
                      repo.primary_languages.slice(0, 2).map((lang) => (
                        <span key={lang} className="text-[11px] px-1.5 py-0.5 rounded-md bg-muted/60 text-muted-foreground capitalize">
                          {lang}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="hidden md:col-span-2 md:flex md:items-center">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md', meta.className)}>
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>

                  <div className="hidden md:col-span-2 md:flex md:items-center">
                    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md capitalize', isActive ? 'state-verified-soft' : 'chip-outline')}>
                      {isActive ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {repo.status}
                    </span>
                  </div>

                  {/* Actions (menu) */}
                  <div className="flex items-center justify-between md:col-span-1 md:justify-end">
                    <div className="text-xs text-muted-foreground md:hidden">
                      {formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                        <button
                          aria-label={`Actions for ${repo.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-opacity hover:bg-accent"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/repositories/${repo.id}`} onClick={(e) => e.stopPropagation()}>
                            <Eye className="mr-2 h-4 w-4" /> Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/scans/new?repo=${repo.id}`} onClick={(e) => e.stopPropagation()}>
                            <ScanSearch className="mr-2 h-4 w-4" /> New scan
                          </Link>
                        </DropdownMenuItem>
                        {repo.source_url && (
                          <DropdownMenuItem asChild>
                            <a href={repo.source_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="mr-2 h-4 w-4" /> Open
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(repo);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <RepositoryImportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialTab={initialTab}
        onImported={() => undefined}
      />
    </div>
  );
}

export default function RepositoriesPage() {
  return (
    <Suspense fallback={<Loader2 className="mx-auto mt-16 h-6 w-6 animate-spin text-muted-foreground" />}>
      <RepositoriesContent />
    </Suspense>
  );
}
