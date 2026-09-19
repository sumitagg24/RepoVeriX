'use client';

import * as React from 'react';
import Link from 'next/link';
import { Github, Gitlab } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/panel';
import { Wordmark } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { useOAuthProviders } from '@/hooks/use-platform';
import { oauthService } from '@/services/api';
import type { OAuthProviderName } from '@/types/api';
import { cn } from '@/lib/utils';

/** Inline SVG brand icons for providers not in lucide-react. */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function BitbucketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">
      <path
        d="M2 5.61A1 1 0 0 0 1 6.8l4.3 19.6a1.39 1.39 0 0 0 1.36 1.1h18.69a1 1 0 0 0 1-.84L30.92 6.8a1 1 0 0 0-1-1.19zm17.23 14.6h-6.5l-1.76-9.22h9.9z"
        fill="#2684FF"
      />
    </svg>
  );
}

/**
 * Auth surface.
 *
 * Two columns: the form (never wider than comfortable reading measure) and, on
 * large screens, a quiet statement of what the product does with the account
 * being created. No terminal imagery, no marketing stack — a person signing in
 * wants their password field and one useful sentence about the product behind it.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  width = 'form',
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: 'form' | 'wide';
}) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-sm px-2 py-1 text-[13px] text-muted transition-colors hover:text-ink"
            >
              Back to site
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-x-16 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:py-16">
        <main id="main" className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-muted">{description}</p>
          ) : null}
          <div className={cn('mt-7', width === 'wide' && 'lg:max-w-2xl')}>{children}</div>
          {footer ? <div className="mt-7 border-t border-hairline pt-5 text-[13px] text-muted">{footer}</div> : null}
        </main>

        <aside className="mt-12 hidden border-l border-hairline pl-16 lg:mt-0 lg:block">
          <p className="max-w-[34ch] text-[15px] leading-relaxed text-body">
            <span className="font-medium text-ink">Every finding arrives with its evidence.</span> The path
            from input to sink, the confidence in the claim, and the check that verified the repair.
          </p>
          <dl className="mt-9 space-y-6">
            {[
              {
                term: 'What runs',
                detail: 'Deterministic detectors on a stored snapshot. Model-assisted stages only in the configurations that ask for them.',
              },
              {
                term: 'What is produced',
                detail: 'Findings with file and line evidence, candidate patches, SARIF and Markdown exports.',
              },
              {
                term: 'What verification proves',
                detail: 'That the checks ran against a patched tree and the finding no longer reproduces. Nothing wider than that.',
              },
            ].map((item) => (
              <div key={item.term}>
                <dt className="text-[12.5px] font-medium text-ink">{item.term}</dt>
                <dd className="mt-1 max-w-[42ch] text-[13px] leading-relaxed text-body">{item.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 text-[12.5px] leading-relaxed text-muted">
            Python, JavaScript and TypeScript are parsed today. Verification needs a deployment with
            container support.
          </p>
        </aside>
      </div>
    </div>
  );
}

/** Error block shared by every auth form: the backend `detail` string verbatim. */
export function AuthError({ message, className }: { message: React.ReactNode; className?: string }) {
  return (
    <Callout tone="critical" className={className} title="That did not work">
      {message}
    </Callout>
  );
}

/**
 * Provider sign-in.
 *
 * Only providers the deployment actually configured are rendered, and a provider
 * that cannot sign in is never shown — a disabled GitHub button on a deployment
 * without a GitHub app would be a lie the interface cannot afford.
 */
export function OAuthButtons({ next = '/dashboard' }: { next?: string }) {
  const providers = useOAuthProviders();
  const [pending, setPending] = React.useState<OAuthProviderName | null>(null);

  // Deterministic display order regardless of what the backend sends back.
  const ORDER: OAuthProviderName[] = ['github', 'gitlab', 'google', 'microsoft', 'bitbucket'];

  const available = React.useMemo(() => {
    const data = providers.data;
    if (!data) return [];
    const configured = (Object.entries(data) as [OAuthProviderName, { configured: boolean; supports_signin: boolean }][])
      .filter(([, info]) => info.configured && info.supports_signin)
      .map(([name]) => name);
    return ORDER.filter((p) => configured.includes(p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers.data]);

  if (providers.isLoading || available.length === 0) return null;

  const label: Record<OAuthProviderName, string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    google: 'Google',
    microsoft: 'Microsoft',
    bitbucket: 'Bitbucket',
  };

  function ProviderIcon({ provider }: { provider: OAuthProviderName }) {
    switch (provider) {
      case 'github':
        return <Github className="size-4" aria-hidden="true" />;
      case 'gitlab':
        return <Gitlab className="size-4" aria-hidden="true" />;
      case 'google':
        return <GoogleIcon className="size-4" />;
      case 'microsoft':
        return <MicrosoftIcon className="size-4" />;
      case 'bitbucket':
        return <BitbucketIcon className="size-4" />;
      default:
        return null;
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[12px] text-muted">or continue with</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((provider) => (
          <Button
            key={provider}
            variant="secondary"
            size="md"
            className="flex-1 min-w-[120px]"
            loading={pending === provider}
            onClick={() => {
              setPending(provider);
              // Full-page navigation: the provider must return to the backend
              // callback, which owns the OAuth state cookie.
              window.location.href = oauthService.loginUrl(provider, next);
            }}
          >
            <ProviderIcon provider={provider} />
            {label[provider]}
          </Button>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
        <Tooltip label="The provider returns you to this deployment's callback, which hands the session back to the app.">
          <span className="cursor-help underline decoration-dotted underline-offset-4">
            How this works
          </span>
        </Tooltip>
      </p>
    </div>
  );
}

/** One-line success / neutral outcome used after a submit that is not a redirect. */
export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <Callout tone="verified" className="mt-5" title="Done">
      {children}
    </Callout>
  );
}
