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

  const available = React.useMemo(() => {
    const data = providers.data;
    if (!data) return [];
    return (Object.entries(data) as [OAuthProviderName, { configured: boolean; supports_signin: boolean }][])
      .filter(([, info]) => info.configured && info.supports_signin)
      .map(([name]) => name);
  }, [providers.data]);

  if (providers.isLoading || available.length === 0) return null;

  const label: Record<OAuthProviderName, string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    google: 'Google',
  };

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
            className="flex-1"
            loading={pending === provider}
            onClick={() => {
              setPending(provider);
              // Full-page navigation: the provider must return to the backend
              // callback, which owns the OAuth state cookie.
              window.location.href = oauthService.loginUrl(provider, next);
            }}
          >
            {provider === 'github' ? (
              <Github className="size-4" aria-hidden="true" />
            ) : provider === 'gitlab' ? (
              <Gitlab className="size-4" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="text-[13px] font-semibold">
                G
              </span>
            )}
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
