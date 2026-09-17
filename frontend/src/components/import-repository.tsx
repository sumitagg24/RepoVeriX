'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService, repositoryService } from '@/services/api';
import { useRepositories } from '@/hooks/useRepositories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Github,
  Gitlab,
  GitBranch,
  UploadCloud,
  Cloud,
  Search,
  Loader2,
  Lock,
  Check,
  FolderGit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import type { SourceType } from '@/types/api';

type ImportTab = 'github' | 'gitlab' | 's3' | 'zip' | 'git';

const SOURCES: {
  id: ImportTab;
  label: string;
  description: string;
  icon: typeof Github;
  accent: string;
}[] = [
  { id: 'github', label: 'GitHub', description: 'Connect your account or paste a URL', icon: Github, accent: 'text-foreground' },
  { id: 'gitlab', label: 'GitLab', description: 'Connect your account or paste a URL', icon: Gitlab, accent: 'text-[#E24329]' },
  { id: 's3', label: 'S3 · archive link', description: 'AWS bucket, presigned URL or hosted zip', icon: Cloud, accent: 'text-[#E8873A]' },
  { id: 'zip', label: 'Upload ZIP', description: 'From your computer', icon: UploadCloud, accent: 'text-primary' },
  { id: 'git', label: 'Other git', description: 'Bitbucket, Azure Repos, self-hosted', icon: GitBranch, accent: 'text-muted-foreground' },
];

function SourceNameInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="repo-name">Repository name</Label>
      <Input id="repo-name" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function deriveNameFromUrl(url: string): string {
  try {
    const path = new URL(url)
      .pathname.replace(/\/+$/, '')
      .replace(/\.git$/, '')
      .replace(/\.(zip|tgz|tar\.gz|gz|rar)$/i, '');
    const seg = path.split('/').filter(Boolean).pop();
    return seg || 'repository';
  } catch {
    return 'repository';
  }
}

function OAuthBrowse({
  provider,
  configured,
  onImport,
}: {
  provider: 'github' | 'gitlab';
  configured: boolean;
  onImport: (path: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const reposQuery = useQuery({
    queryKey: ['oauth-repos', provider],
    queryFn: () => authService.oauthRepos(provider),
    enabled: configured,
    retry: false,
    staleTime: 30_000,
  });

  const connect = () => {
    router.push(authService.oauthLoginUrl(provider, `/repositories?import=1&tab=${provider}`));
  };

  if (!configured) {
    return (
      <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground space-y-3">
        <p>
          {provider === 'github' ? 'GitHub' : 'GitLab'} OAuth is not configured on this server yet.
        </p>
        <p className="text-xs">
          Set <code className="rounded bg-muted px-1 py-0.5">REPOVERIX_{provider.toUpperCase()}_OAUTH_CLIENT_ID</code> and{' '}
          <code className="rounded bg-muted px-1 py-0.5">_SECRET</code> in the backend .env — or import with a URL below.
        </p>
      </div>
    );
  }

  if (reposQuery.isError || (reposQuery.data && reposQuery.data.length === 0 && !reposQuery.isLoading)) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground space-y-3">
          <p className="font-medium text-foreground">
            {reposQuery.isError ? 'Not connected yet' : 'No repositories found'}
          </p>
          <p className="text-xs">
            {reposQuery.isError
              ? 'Connect your account once to browse private & public repositories.'
              : 'Grant access to repositories, then come back here.'}
          </p>
          <Button variant="outline" onClick={connect}>
            Connect {provider === 'github' ? 'GitHub' : 'GitLab'} account
          </Button>
        </div>
      </div>
    );
  }

  const repos = reposQuery.data ?? [];
  const filtered = repos.filter((r) =>
    (r.full_name + ' ' + (r.description ?? '')).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your repositories…" className="pl-9" />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-muted/30 p-1.5">
        {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No matches</p>}
        {filtered.map((repo) => (
          <button
            key={repo.id}
            onClick={() => onImport(repo.full_name)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-card hover:shadow-sm"
          >
            <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{repo.full_name}</span>
              {repo.description && <span className="block truncate text-xs text-muted-foreground">{repo.description}</span>}
            </span>
            {repo.private && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground">
              <Check className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={connect} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
          Switch account
        </button>
        <span className="text-xs text-muted-foreground">{repos.length} accessible</span>
      </div>
    </div>
  );
}

function UrlImportForm({
  source,
  label,
  placeholder,
  hint,
  submitLabel,
  onSubmit,
}: {
  source: Extract<SourceType, 'github' | 'gitlab' | 'git' | 'archive'>;
  label: string;
  placeholder: string;
  hint: string;
  submitLabel: string;
  onSubmit: (name: string, url: string) => Promise<unknown>;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const derived = useMemo(() => (name.trim() ? name : deriveNameFromUrl(url)), [name, url]);

  const submit = async () => {
    if (!url.trim()) {
      toast.error('Please paste a repository URL');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(derived, url.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="repo-url">{label}</Label>
        <Input
          id="repo-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <SourceNameInput value={derived} onChange={setName} placeholder={deriveNameFromUrl(url)} />
      <Button className="w-full gap-2" onClick={submit} disabled={busy || !url.trim()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {busy ? 'Adding…' : submitLabel}
      </Button>
    </div>
  );
}

function ZipUploadForm({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const choose = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      toast.error('Only .zip archives are supported');
      return;
    }
    setFile(f);
    if (!name.trim()) setName(f.name.replace(/\.zip$/i, ''));
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await repositoryService.createFromZip(name.trim() || file.name.replace(/\.zip$/i, ''), file);
      onUploaded();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/40'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          choose(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{file ? file.name : 'Drop your archive here or click to browse'}</p>
          <p className="text-xs text-muted-foreground">.zip up to 100 MB — extracted safely in a sandbox</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => choose(e.target.files?.[0] ?? null)}
        />
      </div>
      <SourceNameInput value={name} onChange={setName} placeholder="my-project" />
      <Button className="w-full gap-2" onClick={upload} disabled={!file || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
        {busy ? 'Uploading…' : 'Upload and add repository'}
      </Button>
    </div>
  );
}

export function ImportRepositoryPanel({
  initialTab = 'github',
  onImported,
}: {
  initialTab?: ImportTab;
  onImported?: (repoId?: string) => void;
}) {
  const queryClient = useQueryClient();
  const { refetch } = useRepositories();
  const [tab, setTab] = useState<ImportTab>(initialTab);

  const providers = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: authService.oauthProviders,
    staleTime: Infinity,
  });

  const done = (id?: string) => {
    toast.success('Repository added — ready to scan');
    queryClient.invalidateQueries({ queryKey: ['repositories'] });
    refetch();
    onImported?.(id);
  };

  const importing = useMutation({
    mutationFn: async ({ name, url }: { name: string; url: string }) =>
      repositoryService.create({
        name,
        source_type: tab as 'github' | 'gitlab' | 'git',
        source_url: url,
      }),
    onSuccess: (repo) => done(repo.id),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const archiving = useMutation({
    mutationFn: ({ name, url }: { name: string; url: string }) => repositoryService.createFromArchive({ name, url }),
    onSuccess: (repo) => done(repo.id),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });
  const oauthImport = useMutation({
    mutationFn: ({ provider, path }: { provider: 'github' | 'gitlab'; path: string }) =>
      repositoryService.createFromOAuth({ provider, repo_path: path }),
    onSuccess: (repo) => done(repo.id),
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const current = SOURCES.find((s) => s.id === tab)!;
  const configured = providers.data?.[tab === 'github' || tab === 'gitlab' ? tab : 'github']?.configured ?? false;

  return (
    <div className="flex flex-col gap-5">
      {/* Source rail */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {SOURCES.map((s) => {
          const active = s.id === tab;
          return (
            <button
              key={s.id}
              onClick={() => setTab(s.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                active
                  ? 'border-primary/30 bg-primary/5 shadow-sm'
                  : 'border-transparent hover:border-border hover:bg-card hover:shadow-sm'
              )}
            >
              <s.icon className={cn('h-4 w-4 shrink-0', s.accent)} />
              <span className="min-w-0">
                <span className={cn('block truncate text-sm font-medium', active && 'text-primary')}>{s.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{s.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="border-t pt-5">
        {tab === 'github' && (
          <div className="space-y-5">
            <OAuthBrowse provider="github" configured={configured} onImport={(p) => oauthImport.mutate({ provider: 'github', path: p })} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or paste a public URL <span className="h-px flex-1 bg-border" />
            </div>
            <UrlImportForm
              source="github"
              label="GitHub repository URL"
              placeholder="https://github.com/octocat/hello-world"
              hint="Public repositories can be imported without an account."
              submitLabel="Add GitHub repository"
              onSubmit={(name, url) => importing.mutateAsync({ name, url })}
            />
          </div>
        )}

        {tab === 'gitlab' && (
          <div className="space-y-5">
            <OAuthBrowse provider="gitlab" configured={configured} onImport={(p) => oauthImport.mutate({ provider: 'gitlab', path: p })} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or paste a URL <span className="h-px flex-1 bg-border" />
            </div>
            <UrlImportForm
              source="gitlab"
              label="GitLab repository URL"
              placeholder="https://gitlab.com/group/project"
              hint="Public GitLab.com or self-hosted GitLab instances."
              submitLabel="Add GitLab repository"
              onSubmit={(name, url) => importing.mutateAsync({ name, url })}
            />
          </div>
        )}

        {tab === 's3' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 p-3.5 text-sm">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1 text-muted-foreground">
                <p className="font-medium text-foreground">Private buckets work too</p>
                <p className="text-xs leading-relaxed">
                  Paste a presigned S3 URL or any direct archive link (public object, GitHub release asset, codeload). The file is
                  downloaded once and extracted with the same safety checks as ZIP uploads.
                </p>
              </div>
            </div>
            <UrlImportForm
              source="archive"
              label="Archive URL"
              placeholder="https://bucket-name.s3.amazonaws.com/project.zip?X-Amz-Signature=…"
              hint="HTTPS .zip URL — e.g. an AWS S3 object, a presigned link, or a release asset."
              submitLabel="Fetch and add repository"
              onSubmit={(name, url) => archiving.mutateAsync({ name, url })}
            />
          </div>
        )}

        {tab === 'zip' && <ZipUploadForm onUploaded={() => done()} />}

        {tab === 'git' && (
          <UrlImportForm
            source="git"
            label="Git repository URL"
            placeholder="https://bitbucket.org/acme/widgets"
            hint="Any https git host: Bitbucket, Azure DevOps, Codeberg, Gitea, self-hosted…"
            submitLabel="Add git repository"
            onSubmit={(name, url) => importing.mutateAsync({ name, url })}
          />
        )}
      </div>
    </div>
  );
}

export function RepositoryImportDialog({
  open,
  onOpenChange,
  initialTab = 'github',
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: ImportTab;
  onImported?: (repoId?: string) => void;
}) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Import a repository</DialogTitle>
          <DialogDescription>
            Connect a hosting provider, fetch from a bucket or archive link, or upload from your computer.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto px-0.5 py-1">
          <ImportRepositoryPanel
            initialTab={initialTab}
            onImported={(id) => {
              onImported?.(id);
              onOpenChange(false);
              if (id) router.push(`/scans/new?repo=${id}`);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
