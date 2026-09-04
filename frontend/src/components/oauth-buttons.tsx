'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Github, Gitlab, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { OAuthProviderName } from '@/types/api';

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

const LABELS: Record<OAuthProviderName, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
  gitlab: 'Continue with GitLab',
};

const ICONS: Record<OAuthProviderName, React.ComponentType<{ className?: string }>> = {
  google: GoogleGlyph,
  github: Github,
  gitlab: Gitlab,
};

export function useOAuthProviders() {
  return useQuery({
    queryKey: ['oauth-providers'],
    queryFn: authService.oauthProviders,
    staleTime: 5 * 60_000,
  });
}

export function OAuthSignInButton({
  provider,
  next = '/dashboard',
  variant = 'outline',
  className,
}: {
  provider: OAuthProviderName;
  next?: string;
  variant?: 'outline' | 'secondary' | 'default';
  className?: string;
}) {
  const { data, isLoading } = useOAuthProviders();
  const configured = data?.[provider]?.configured ?? false;
  const Icon = ICONS[provider];

  if (isLoading) {
    return (
      <Button variant={variant} className={`w-full gap-2 ${className ?? ''}`} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking…
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      className={`w-full gap-2.5 ${className ?? ''}`}
      disabled={!configured}
      title={
        configured
          ? LABELS[provider]
          : `Not configured — see MANUAL-SETUP.md (REPOVERIX_${provider.toUpperCase()}_OAUTH_CLIENT_ID)`
      }
      onClick={() => {
        if (configured) {
          window.location.href = authService.oauthLoginUrl(provider, next);
        } else {
          toast.info(`${provider[0].toUpperCase()}${provider.slice(1)} OAuth isn't configured on this server yet.`);
        }
      }}
    >
      {provider === 'google' ? <GoogleGlyph className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      {LABELS[provider]}
    </Button>
  );
}
