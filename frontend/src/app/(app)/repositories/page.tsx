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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Repository, SourceType } from '@/types/api';

const SOURCE_META: Record<SourceType, { label: string; icon: typeof Github; className: string }> = {
  github: { label: 'GitHub', icon: Github, className: 'bg-foreground text-background' },
  gitlab: { label: 'GitLab', icon: Gitlab, className: 'bg-[#E24329]/10 text-[#E24329]' },
  git: { label: 'Git', icon: GitBranch, className: 'bg-muted text-muted-foreground' },
  archive: { label: 'Archive', icon: Cloud, className: 'bg-[#E8873A]/10 text-[#B45F1B]' },
  zip: { label: 'ZIP', icon: UploadCloud, className: 'bg-primary/10 text-primary' },
};

function SourceIcon({ source }: { source: SourceType }) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.className}`}>
      <Icon className="h-4.5 w-4.5" />
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

  // Support ?import=1&tab=github deep links (e.g. returning from an OAuth
  // connect) by opening the dialog once and clearing the query string.
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Repositories</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-balance">
            Code you want to audit
          </h1>
          <p className="mt-1 text-muted-foreground">
            Import from GitHub, GitLab, AWS S3 or a zip — then run a scan.
          </p>
        </div>
        <Button onClick={() => openImport('github')} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Import repository
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search repositories…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl bg-card"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/70" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/40 py-16 text-center">
          <FolderGit2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
          <h3 className="font-display text-xl font-medium">{searchQuery ? 'No matches' : 'Nothing to audit yet'}</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {searchQuery
              ? 'Try a different search term.'
              : 'Bring in a repository from GitHub, GitLab, an S3 archive link, or a zip file.'}
          </p>
          {!searchQuery && (
            <Button onClick={() => openImport('github')} className="mt-5 gap-2">
              <Plus className="h-4 w-4" /> Import your first repository
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((repo) => {
            const meta = SOURCE_META[repo.source_type];
            return (
              <div
                key={repo.id}
                className="group rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-px"
              >
                <div className="flex items-start gap-3">
                  <SourceIcon source={repo.source_type} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/repositories/${repo.id}`}
                      className="block truncate text-[15px] font-semibold hover:text-primary"
                    >
                      {repo.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="gap-1 font-normal">
                        {meta.icon && <meta.icon className="h-3 w-3" />}
                        {meta.label}
                      </Badge>
                      {repo.primary_languages?.slice(0, 3).map((lang) => (
                        <span key={lang} className="rounded bg-muted px-1.5 py-0.5 capitalize">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/repositories/${repo.id}`}>
                          <Eye className="mr-2 h-4 w-4" /> Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/scans/new?repo=${repo.id}`}>
                          <ScanSearch className="mr-2 h-4 w-4" /> New scan
                        </Link>
                      </DropdownMenuItem>
                      {repo.source_url && (
                        <DropdownMenuItem asChild>
                          <a href={repo.source_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> Open repository
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(repo)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                  <span className="capitalize">{repo.status}</span>
                  <span>{formatDistanceToNow(new Date(repo.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            );
          })}
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
