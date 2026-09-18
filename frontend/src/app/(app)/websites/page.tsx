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
import { useBilling } from '@/hooks/useBilling';
import { Globe, Globe2, Loader2, Plus, Trash2, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { PageHeader } from '@/components/system/page-header';
import { cn } from '@/lib/utils';
import { toneBar } from '@/lib/tone';

function normalizeInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Tech-forward website audit dashboard.
 * Displays websites as score cards with health indicators.
 */
export default function WebsitesPage() {
  const [url, setUrl] = useState('');
  const websites = useWebsites();
  const register = useRegisterWebsite();
  const remove = useDeleteWebsite();
  const startAudit = useCreateWebsiteAudit();
  const { data: billing } = useBilling();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeInput(url);
    if (!normalized || register.isPending) return;
    register.mutate(normalized, { onSuccess: () => setUrl('') });
  };

  return (
    <div className="space-y-6 animate-page">
      <PageHeader
        eyebrow="Audits"
        title="Website Audits"
        description={`${websites.data?.length ?? 0} website${websites.data?.length === 1 ? '' : 's'} monitored`}
        actions={
          <Button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Add website
          </Button>
        }
      />

      {/* Registration form — tech-focused */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" /> Register Website
          </CardTitle>
          <CardDescription>
            Passive analysis: SEO, security headers, accessibility, performance. No login, no exploit testing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="website-url" className="text-xs font-semibold uppercase tracking-wide">
                  Public URL
                </Label>
                <Input
                  id="website-url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  inputMode="url"
                  autoComplete="off"
                  className="rounded-lg bg-muted/40 border border-border/60"
                  aria-describedby="website-url-help"
                />
              </div>
              <Button 
                type="submit" 
                disabled={!normalizeInput(url) || register.isPending}
                className="gap-2"
              >
                {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add
              </Button>
            </div>
            <p id="website-url-help" className="text-xs text-muted-foreground">
              Same-origin crawl only • Max 10 pages • robots.txt respected • Standard ports only
            </p>
          </form>
          {(register.isError || remove.isError || startAudit.isError) && (
            <p className="mt-3 text-sm text-destructive font-medium" role="alert">
              {register.error instanceof Error ? register.error.message : ''}
              {remove.error instanceof Error ? remove.error.message : ''}
              {startAudit.error instanceof Error ? startAudit.error.message : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage meter */}
      {billing && (
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">
            Monthly audits:
          </span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${
                    (billing.usage.website_audits_used / billing.plan.website_audits_per_month) * 100
                  }%`,
                }}
              />
            </div>
            <span className="text-xs font-mono font-semibold whitespace-nowrap">
              {billing.usage.website_audits_used} / {billing.plan.website_audits_per_month}
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {websites.isLoading && <ListSkeleton rows={3} />}

      {/* Error state */}
      {websites.isError && (
        <QueryError
          error={websites.error}
          onRetry={() => websites.refetch()}
          title="Websites could not be loaded"
        />
      )}

      {/* Empty state */}
      {websites.data && websites.data.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-card/30">
          <EmptyState
            icon={Globe2}
            title="No websites registered"
            body="Add a public URL above to run your first passive website audit. RepoVeriX will crawl the site and analyze SEO, security, accessibility, and performance."
          />
        </div>
      )}

      {/* Websites grid */}
      {websites.data && websites.data.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-muted-foreground">
            {websites.data.length} website{websites.data.length === 1 ? '' : 's'}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {websites.data.map((site) => {
              // Determine health based on presence of recent audit
              const hasRecentAudit = site.last_audit_at && 
                new Date().getTime() - new Date(site.last_audit_at).getTime() < 7 * 24 * 60 * 60 * 1000;
              
              return (
                <Link
                  key={site.id}
                  href={`/websites/${site.id}`}
                  className="data-row group"
                >
                  <Card className="h-full transition-all hover:border-primary/40 hover:bg-accent/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="truncate text-base group-hover:text-primary">
                            {site.hostname}
                          </CardTitle>
                          <CardDescription className="truncate text-xs mt-1">
                            {site.url}
                          </CardDescription>
                        </div>
                        {/* The dot is decorative: the state is carried by the
                            visually hidden text, so it is never colour-only. */}
                        <span className="flex shrink-0 items-center">
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              hasRecentAudit ? toneBar('verified') : toneBar('neutral')
                            )}
                            title={hasRecentAudit ? 'Recently audited' : 'Not recently audited'}
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            {hasRecentAudit ? 'Recently audited' : 'Not recently audited'}
                          </span>
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Audit status */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Last audit</span>
                        <span className="font-mono font-semibold">
                          {site.last_audit_at
                            ? formatDistanceToNow(new Date(site.last_audit_at), { addSuffix: true })
                            : '—'}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={startAudit.isPending}
                          onClick={(e) => {
                            e.preventDefault();
                            startAudit.mutate({ websiteId: site.id });
                          }}
                          className="flex-1 gap-1.5 text-xs h-8"
                        >
                          {startAudit.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          Audit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            if (window.confirm(`Delete "${site.hostname}"?`)) {
                              remove.mutate(site.id);
                            }
                          }}
                          className="h-8 w-8 p-0"
                          title="Delete website"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
