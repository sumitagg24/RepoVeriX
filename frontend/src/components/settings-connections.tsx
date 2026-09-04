'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Github, Gitlab, Link2, Loader2, Unlink, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { OAuthProviderName } from '@/types/api';

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

const ICONS: Record<OAuthProviderName, React.ComponentType<{ className?: string }>> = {
  google: GoogleGlyph,
  github: Github,
  gitlab: Gitlab,
};

const DESCRIPTIONS: Record<OAuthProviderName, string> = {
  google: 'Sign in with one click',
  github: 'Sign in + import private repositories',
  gitlab: 'Sign in + import private repositories',
};

export function SettingsConnections() {
  const queryClient = useQueryClient();

  const providers = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: authService.oauthProviders,
    staleTime: 5 * 60_000,
  });
  const connections = useQuery({
    queryKey: ['oauth-connections'],
    queryFn: authService.oauthConnections,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['oauth-connections'] });
  };

  const disconnect = async (provider: OAuthProviderName) => {
    if (!window.confirm(`Disconnect your ${provider} account? Repositories already imported stay intact.`)) return;
    try {
      await authService.oauthDisconnect(provider);
      toast.success(`${provider} disconnected`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Disconnect failed');
    }
  };

  if (providers.isLoading || connections.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading connections…
      </div>
    );
  }

  const list = connections.data ?? [];
  const providerList = (Object.keys(providers.data ?? {}) as OAuthProviderName[]).filter(
    (p) => providers.data?.[p]?.configured
  );

  return (
    <div className="space-y-4">
      {providerList.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No providers are configured on this server yet. Add OAuth credentials (see{' '}
          <code className="rounded bg-muted px-1">MANUAL-SETUP.md</code>) to enable one-click sign-in and
          private repository imports.
        </div>
      )}

      {providerList.map((provider) => {
        const conn = list.find((c) => c.provider === provider);
        const Icon = ICONS[provider];
        return (
          <div
            key={provider}
            className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold capitalize">{provider}</p>
                {conn ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline">Not connected</Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {conn ? conn.provider_email || 'Access granted' : DESCRIPTIONS[provider]}
              </p>
            </div>
            {conn ? (
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => disconnect(provider)}>
                <Unlink className="h-3.5 w-3.5" /> Disconnect
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  window.location.href = authService.oauthLoginUrl(provider, '/settings');
                }}
              >
                <Link2 className="h-3.5 w-3.5" /> Connect
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
