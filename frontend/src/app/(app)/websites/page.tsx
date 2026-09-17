'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EmptyState,
  ListSkeleton,
  QueryError,
} from '@/components/ui/state';
import { useCreateWebsiteAudit, useDeleteWebsite, useRegisterWebsite, useWebsites } from '@/hooks/useWebsites';
import { Globe, Globe2, Loader2, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function normalizeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function WebsitesPage() {
  const [url, setUrl] = useState('');
  const websites = useWebsites();
  const register = useRegisterWebsite();
  const remove = useDeleteWebsite();
  const startAudit = useCreateWebsiteAudit();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeInput(url);
    if (!normalized || register.isPending) return;
    register.mutate(normalized, { onSuccess: () => setUrl('') });
  };

  const detailFor = (id: string) => `/websites/${id}`;

  return (
    <div className="space-y-6 p-6 animate-page">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website Audits</h1>
          <p className="text-sm text-muted-foreground">
            Passive analysis of public pages: SEO, security headers, accessibility and
            AI-search readiness signals.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" /> Add a website
          </CardTitle>
          <CardDescription>
            RepoVeriX fetches what any visitor could see — nothing more. No login attempts,
            no exploit testing, no destructive requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="website-url">Public URL</Label>
              <Input
                id="website-url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                autoComplete="off"
                aria-describedby="website-url-help"
              />
              <p id="website-url-help" className="text-xs text-muted-foreground">
                Same-origin crawl only, max 10 pages, standard ports, robots.txt respected.
              </p>
            </div>
            <Button type="submit" disabled={!normalizeInput(url) || register.isPending}>
              {register.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
              Add website
            </Button>
          </form>
          {(register.isError || remove.isError || startAudit.isError) && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {register.error instanceof Error ? register.error.message : ''}
              {remove.error instanceof Error ? remove.error.message : ''}
              {startAudit.error instanceof Error ? startAudit.error.message : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {websites.isLoading && <ListSkeleton rows={3} />}

      {websites.isError && (
        <QueryError
          error={websites.error}
          onRetry={() => websites.refetch()}
          title="Websites could not be loaded"
        />
      )}

      {websites.data && websites.data.length === 0 && (
        <EmptyState
          icon={Globe2}
          title="No websites yet"
          body="Add a public URL above to run your first passive website audit."
        />
      )}

      {websites.data && websites.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Registered websites</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {websites.data.map((site) => (
                <li key={site.id} className="data-row flex items-center gap-4 px-4 py-3">
                  <Globe className="h-5 w-5 flex-none text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <Link href={detailFor(site.id)} className="font-medium hover:text-primary hover:underline">
                      {site.hostname}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {site.url}
                      {site.last_audit_at &&
                        ` · last audit ${formatDistanceToNow(new Date(site.last_audit_at), { addSuffix: true })}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={startAudit.isPending}
                    onClick={() => startAudit.mutate({ websiteId: site.id })}
                  >
                    {startAudit.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Audit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${site.hostname}`}
                    onClick={() => remove.mutate(site.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
