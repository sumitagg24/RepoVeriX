'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Github, Gitlab } from 'lucide-react';
import type { OAuthProviderName } from '@/types/api';

/**
 * OAuth provider buttons.
 *
 * Which providers exist is a *runtime* property of the deployment, not a
 * frontend guess: `/auth/oauth/providers` reports which ones the server has
 * credentials for. Two rules follow from that, and both were violated before:
 *
 *  1. Never render a provider the server cannot complete a login with. The
 *     previous version rendered all three and merely *disabled* the
 *     unconfigured ones, whose tooltip told end users to go read
 *     `MANUAL-SETUP.md` and set `REPOVERIX_GOOGLE_OAUTH_CLIENT_ID` — internal
 *     release instructions leaking onto a public sign-in page.
 *  2. Never show three "Checking…" buttons while the config request is in
 *     flight; that is a guaranteed layout shift in the middle of the auth flow.
 *     One skeleton block resolves to the same footprint.
 */

/** Render order: the broadest-reach provider reads best as the primary button. */
const PROVIDER_ORDER: OAuthProviderName[] = ['google', 'github', 'gitlab'];

const LABELS: Record<OAuthProviderName, string> = {
  google: 'Continue with Google',
  github: 'Continue with GitHub',
  gitlab: 'Continue with GitLab',
};

/** Google's mark is a fixed four-colour brand asset, not a themeable icon. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
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

const ICONS: Record<OAuthProviderName, React.ComponentType<{ className?: string }>> = {
  google: GoogleMark,
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

function ProviderButton({
  provider,
  next,
  variant = 'outline',
  className,
}: {
  provider: OAuthProviderName;
  next: string;
  variant?: 'outline' | 'secondary' | 'default';
  className?: string;
}) {
  const Icon = ICONS[provider];
  return (
    <Button
      // Not a submit button: these sit above an email form on the same screen.
      type="button"
      variant={variant}
      className={`w-full justify-center gap-2.5 ${className ?? ''}`}
      onClick={() => {
        window.location.href = authService.oauthLoginUrl(provider, next);
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{LABELS[provider]}</span>
    </Button>
  );
}

export function OAuthProviderGroup({ next = '/dashboard' }: { next?: string }) {
  const { data, isLoading } = useOAuthProviders();
  const available = PROVIDER_ORDER.filter((provider) => data?.[provider]?.configured);

  if (isLoading) {
    return (
      <div className="space-y-2.5" aria-busy="true" aria-label="Loading sign-in providers">
        <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  // No configured provider: render nothing at all. An auth screen that offers
  // email/password is complete on its own; a heading, an empty grid, or a
  // disabled button would only signal that something is broken.
  if (available.length === 0) return null;

  const [primary, ...secondary] = available;

  return (
    <div>
      <div className="space-y-2.5">
        <ProviderButton provider={primary} next={next} />
        {secondary.length > 0 && (
          <div className={secondary.length > 1 ? 'grid grid-cols-2 gap-2.5' : undefined}>
            {secondary.map((provider) => (
              <ProviderButton key={provider} provider={provider} next={next} />
            ))}
          </div>
        )}
      </div>

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or with email</span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}

/**
 * Single provider button, kept for callers that need one provider on its own
 * (e.g. a sidebar "reconnect GitLab" action). Renders nothing when the server
 * has no credentials for that provider.
 */
export function OAuthSignInButton({
  provider,
  next = '/dashboard',
  variant = 'outline',
  className,
  onRedirect,
}: {
  provider: OAuthProviderName;
  next?: string;
  variant?: 'outline' | 'secondary' | 'default';
  className?: string;
  onRedirect?: () => void;
}) {
  const { data, isLoading } = useOAuthProviders();

  if (isLoading) {
    return <div className="h-10 w-full animate-pulse rounded-md bg-muted" />;
  }
  if (!data?.[provider]?.configured) return null;

  return (
    <div onClickCapture={onRedirect} className={className ? `w-full ${className}` : 'w-full'}>
      <ProviderButton provider={provider} next={next} variant={variant} />
    </div>
  );
}
