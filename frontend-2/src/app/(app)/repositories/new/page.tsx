'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Cloud,
  GitBranch,
  Link2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Callout, Panel, PanelHeader } from '@/components/ui/panel';
import { EmptyState, InlineError, LoadingRegion } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/menu';
import {
  useImportFromArchive,
  useImportFromProvider,
  useImportFromZip,
  useCreateRepository,
} from '@/hooks/use-repositories';
import { useOAuthConnections, useOAuthProviders, useProviderRepositories } from '@/hooks/use-platform';
import { oauthService, toApiFailure } from '@/services/api';
import type { OAuthProviderName, SourceType } from '@/types/api';

/**
 * Import a repository.
 *
 * Five import paths, all of them real endpoints. Each tab states the
 * configuration it needs before the form is filled in, so a missing OAuth app is
 * discovered on the page rather than after a failed submit. Git URLs, archive
 * URLs and ZIP uploads have no provider requirement at all.
 */
const PROVIDER_TABS: { provider: Extract<OAuthProviderName, 'github' | 'gitlab'>; label: string }[] = [
  { provider: 'github', label: 'GitHub' },
  { provider: 'gitlab', label: 'GitLab' },
];

export default function NewRepositoryPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState('git');
  const [error, setError] = React.useState<string | null>(null);

  const createGit = useCreateRepository();
  const createArchive = useImportFromArchive();
  const createZip = useImportFromZip();
  const createProvider = useImportFromProvider();
  const providers = useOAuthProviders();
  const connections = useOAuthConnections();

  const [gitForm, setGitForm] = React.useState({
    name: '',
    source_url: '',
    default_branch: 'main',
  });
  const [archiveForm, setArchiveForm] = React.useState({
    name: '',
    url: '',
    default_branch: 'main',
  });
  const [zipForm, setZipForm] = React.useState<{ name: string; file: File | null }>({
    name: '',
    file: null,
  });

  const finish = (name: string) => {
    toast.success(`${name} imported`);
    router.push('/repositories');
  };

  const run = async (action: () => Promise<{ name: string }>) => {
    setError(null);
    try {
      const repository = await action();
      finish(repository.name);
    } catch (caught) {
      setError(toApiFailure(caught).message);
    }
  };

  return (
    <AppPage>
      <PageHeader
        title="Import a repository"
        crumbs={[{ href: '/repositories', label: 'Repositories' }, { label: 'Import' }]}
        description="Pick the path that matches where the code lives. Every import stores a snapshot; nothing is written back to the source."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/repositories">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to repositories
            </Link>
          </Button>
        }
      />

      {providers.isLoading ? <LoadingRegion label="Checking provider configuration" /> : null}

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList label="Import method">
          <TabsTrigger value="git">Git URL</TabsTrigger>
          <TabsTrigger value="archive">Archive URL</TabsTrigger>
          <TabsTrigger value="zip">ZIP upload</TabsTrigger>
          {PROVIDER_TABS.map(({ provider, label }) => (
            <TabsTrigger key={provider} value={provider}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="git">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                createGit.mutateAsync({
                  name: gitForm.name.trim(),
                  source_type: 'git' as SourceType,
                  source_url: gitForm.source_url.trim(),
                  default_branch: gitForm.default_branch.trim() || 'main',
                }),
              );
            }}
          >
            <Panel>
              <PanelHeader
                title="Clone from a Git URL"
                hint="HTTPS URLs go through the deployment’s Git client. Credentialled URLs are stored with the repository, so use a token with read-only scope."
              />
              <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2">
                <Field label="Name" hint="Shown throughout the workspace." required>
                  {(props) => (
                    <Input
                      {...props}
                      value={gitForm.name}
                      onChange={(event) => setGitForm({ ...gitForm, name: event.target.value })}
                      placeholder="checkout-service"
                      required
                    />
                  )}
                </Field>
                <Field label="Default branch" hint="Scanning uses this branch unless a scan says otherwise.">
                  {(props) => (
                    <Input
                      {...props}
                      value={gitForm.default_branch}
                      onChange={(event) =>
                        setGitForm({ ...gitForm, default_branch: event.target.value })
                      }
                      placeholder="main"
                    />
                  )}
                </Field>
                <Field
                  label="Repository URL"
                  hint="HTTPS Git URL, with or without a trailing .git"
                  required
                  className="lg:col-span-2"
                >
                  {(props) => (
                    <Input
                      {...props}
                      type="url"
                      value={gitForm.source_url}
                      onChange={(event) => setGitForm({ ...gitForm, source_url: event.target.value })}
                      placeholder="https://github.com/owner/repository.git"
                      required
                    />
                  )}
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-5 py-4 sm:px-6">
                <Button type="submit" variant="primary" loading={createGit.isPending}>
                  <GitBranch className="size-4" aria-hidden="true" />
                  Import repository
                </Button>
                <span className="text-[12.5px] text-muted">No provider configuration required.</span>
              </div>
            </Panel>
          </form>
        </TabsContent>

        <TabsContent value="archive">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                createArchive.mutateAsync({
                  url: archiveForm.url.trim(),
                  name: archiveForm.name.trim() || undefined,
                  default_branch: archiveForm.default_branch.trim() || 'main',
                }),
              );
            }}
          >
            <Panel>
              <PanelHeader
                title="Import from an archive URL"
                hint="A direct link to a ZIP archive: a release asset, an object store URL, or a presigned URL that expires."
              />
              <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2">
                <Field label="Archive URL" required className="lg:col-span-2">
                  {(props) => (
                    <Input
                      {...props}
                      type="url"
                      value={archiveForm.url}
                      onChange={(event) =>
                        setArchiveForm({ ...archiveForm, url: event.target.value })
                      }
                      placeholder="https://example.com/releases/checkout-1.4.0.zip"
                      required
                    />
                  )}
                </Field>
                <Field label="Name" hint="Optional. Defaults to the name in the archive.">
                  {(props) => (
                    <Input
                      {...props}
                      value={archiveForm.name}
                      onChange={(event) => setArchiveForm({ ...archiveForm, name: event.target.value })}
                      placeholder="checkout-service"
                    />
                  )}
                </Field>
                <Field label="Default branch" hint="Recorded for reference; a snapshot has no branches of its own.">
                  {(props) => (
                    <Input
                      {...props}
                      value={archiveForm.default_branch}
                      onChange={(event) =>
                        setArchiveForm({ ...archiveForm, default_branch: event.target.value })
                      }
                    />
                  )}
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-5 py-4 sm:px-6">
                <Button type="submit" variant="primary" loading={createArchive.isPending}>
                  <Link2 className="size-4" aria-hidden="true" />
                  Import archive
                </Button>
                <span className="text-[12.5px] text-muted">
                  The response is validated as a ZIP, not trusted by file extension.
                </span>
              </div>
            </Panel>
          </form>
        </TabsContent>

        <TabsContent value="zip">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!zipForm.file) {
                setError('Choose a .zip file to upload.');
                return;
              }
              void run(async () => {
                const repository = await createZip.mutateAsync({
                  name: zipForm.name.trim() || zipForm.file!.name.replace(/\.zip$/i, ''),
                  file: zipForm.file!,
                });
                return repository;
              });
            }}
          >
            <Panel>
              <PanelHeader
                title="Upload a ZIP"
                hint="For code the deployment cannot reach over the network. The archive is read once and stored as a snapshot."
              />
              <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2">
                <Field label="Name" hint="Optional. Defaults to the file name without .zip.">
                  {(props) => (
                    <Input
                      {...props}
                      value={zipForm.name}
                      onChange={(event) => setZipForm({ ...zipForm, name: event.target.value })}
                      placeholder="checkout-service"
                    />
                  )}
                </Field>
                <Field
                  label="Archive"
                  hint="ZIP files only. The magic bytes are checked server-side."
                  required
                >
                  {(props) => (
                    <input
                      {...props}
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(event) =>
                        setZipForm({ ...zipForm, file: event.target.files?.[0] ?? null })
                      }
                      className="field file:mr-3 file:rounded-sm file:border-0 file:bg-surface file:px-2.5 file:py-1 file:text-[12.5px] file:font-medium file:text-ink"
                      required
                    />
                  )}
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-hairline px-5 py-4 sm:px-6">
                <Button type="submit" variant="primary" loading={createZip.isPending}>
                  <Upload className="size-4" aria-hidden="true" />
                  Upload and import
                </Button>
                <span className="text-[12.5px] text-muted">
                  Uploads are limited by the deployment’s request size setting.
                </span>
              </div>
            </Panel>
          </form>
        </TabsContent>

        {PROVIDER_TABS.map(({ provider, label }) => {
          const info = providers.data?.[provider];
          const connected = (connections.data ?? []).some((item) => item.provider === provider);
          return (
            <TabsContent key={provider} value={provider}>
              {info && !info.configured ? (
                <Callout
                  tone="warning"
                  title={`${label} is not configured on this deployment`}
                  action={
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/settings/integrations">
                        Integration settings
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    </Button>
                  }
                >
                  The OAuth app for {label} is set on the server. Until it is, imports work through a
                  Git URL, an archive URL or a ZIP upload.
                </Callout>
              ) : null}

              {info && info.configured && !connected ? (
                <Panel>
                  <PanelHeader
                    title={`Connect ${label}`}
                    hint="Signing in to the provider authorises repository listing. The token is stored against your account, not in the browser."
                  />
                  <div className="px-5 py-5 sm:px-6">
                    <a
                      href={oauthService.loginUrl(provider, '/repositories/new')}
                      className="inline-flex items-center gap-2 rounded-md border border-hairline bg-chrome px-4 py-2.5 text-[13.5px] font-medium text-chrome-label transition-colors hover:bg-chrome-hover"
                    >
                      <Cloud className="size-4" aria-hidden="true" />
                      Authorise {label}
                    </a>
                    <p className="mt-3 text-[12.5px] text-muted">
                      You will come back to this page once the provider redirects.
                    </p>
                  </div>
                </Panel>
              ) : null}

              {info && info.configured && connected ? (
                <ProviderRepositoryPicker
                  provider={provider}
                  label={label}
                  pending={createProvider.isPending}
                  onImport={(repoPath, name, defaultBranch) =>
                    void run(() =>
                      createProvider.mutateAsync({
                        provider,
                        repo_path: repoPath,
                        name,
                        default_branch: defaultBranch,
                      }),
                    )
                  }
                />
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>

      {error ? <InlineError>{error}</InlineError> : null}
    </AppPage>
  );
}

/**
 * Provider repository picker. The list comes from the provider through the
 * backend, so the workspace only ever shows repositories the connection can
 * actually read.
 */
function ProviderRepositoryPicker({
  provider,
  label,
  pending,
  onImport,
}: {
  provider: OAuthProviderName;
  label: string;
  pending: boolean;
  onImport: (repoPath: string, name: string, defaultBranch: string) => void;
}) {
  const repositories = useProviderRepositories(provider);
  const [search, setSearch] = React.useState('');

  if (repositories.isLoading) {
    return (
      <Panel>
        <PanelHeader title={`Repositories on ${label}`} hint="Reading the repository list from the provider." />
        <div className="px-5 py-6 sm:px-6">
          <LoadingRegion label={`Loading ${label} repositories`} />
        </div>
      </Panel>
    );
  }

  if (repositories.isError) {
    return (
      <Callout tone="warning" title={`The ${label} repository list could not be read`}>
        The stored token may have expired or lost the repository scope. Reconnect the provider in
        integration settings and try again.
      </Callout>
    );
  }

  const list = (repositories.data ?? []).filter((repository) =>
    search.trim() ? repository.full_name.toLowerCase().includes(search.trim().toLowerCase()) : true,
  );

  return (
    <Panel>
      <PanelHeader
        title={`Repositories on ${label}`}
        hint="Private repositories need the scope granted at authorisation time."
        actions={
          <div className="w-56">
            <label htmlFor="provider-search" className="sr-only">
              Search {label} repositories
            </label>
            <Input
              id="provider-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by names"
            />
          </div>
        }
      />
      <div className="px-5 py-5 sm:px-6">
        {list.length === 0 ? (
          <EmptyState
            icon={<Boxes className="size-4" aria-hidden="true" />}
            title={search ? 'No repository matches that filter' : `No repositories available on ${label}`}
            body={
              search
                ? 'Clear the filter to see every repository the connection can read.'
                : 'The connection may not include repository access, or the account has none it can share.'
            }
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {list.map((repository) => (
              <li
                key={repository.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                    {repository.full_name}
                    {repository.private ? <Badge tone="neutral">Private</Badge> : null}
                  </p>
                  <p className="mt-1 text-[12.5px] text-muted">
                    {repository.description ?? 'No description'} · default branch{' '}
                    <span className="font-mono">{repository.default_branch}</span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={pending}
                  onClick={() =>
                    onImport(
                      repository.full_name,
                      repository.name,
                      repository.default_branch,
                    )
                  }
                >
                  Import
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
