'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Copy, Github, Gitlab } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/panel';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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

export function Auth0Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M21.98 7.348L19.294.544a.434.434 0 00-.518-.276L12.08 2.012 5.385.268a.434.434 0 00-.518.276L2.181 7.348a.434.434 0 00.174.498l9.467 6.442a.434.434 0 00.496 0l9.468-6.442a.434.434 0 00.194-.498z"
        fill="#EB5424"
      />
      <path
        d="M12.08 14.868a.434.434 0 01-.248-.076L2.365 8.35a.434.434 0 00-.608.156L.073 11.532a.434.434 0 00.146.574l11.613 7.897a.434.434 0 00.496 0l11.613-7.897a.434.434 0 00.146-.574l-1.684-3.026a.434.434 0 00-.608-.156l-9.467 6.442a.434.434 0 01-.248.076z"
        fill="#EB5424"
      />
    </svg>
  );
}

function OracleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16.272 5.093c-4.444 0-8.048 3.092-8.048 6.907s3.604 6.907 8.048 6.907c4.444 0 8.048-3.092 8.048-6.907s-3.604-6.907-8.048-6.907zm0 11.233c-2.88 0-5.216-1.938-5.216-4.326s2.336-4.326 5.216-4.326c2.88 0 5.216 1.938 5.216 4.326s-2.336 4.326-5.216 4.326zM7.728 5.093C3.284 5.093-.32 8.185-.32 12s3.604 6.907 8.048 6.907c1.378 0 2.673-.306 3.805-.845-.595-.758-1.074-1.622-1.392-2.569-.747.288-1.558.45-2.413.45-2.88 0-5.216-1.938-5.216-4.326s2.336-4.326 5.216-4.326c.855 0 1.666.162 2.413.45.318-.947.797-1.811 1.392-2.569-1.132-.539-2.427-.845-3.805-.845z"
        fill="#F80000"
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
 * Google, GitHub and GitLab are always present: they are the three identity
 * providers this product is built around, and a sign-in page missing them
 * reads as unfinished. A provider the deployment has configured starts the
 * real consent flow. One it has not configured opens an explanation of the
 * exact server setting that is missing — the button is never a silent dead
 * end, and it never pretends a sign-in is available when it is not.
 *
 * The remaining providers (Microsoft, Bitbucket, Auth0, Oracle) stay opt-in:
 * they appear only when configured, because they are capabilities an operator
 * chooses rather than part of the standard front door.
 *
 * When Auth0 is configured and a standard provider is not configured directly,
 * its button federates through the tenant's connection of the same name
 * instead of rendering a duplicate button for the same provider.
 */
const PRIMARY_PROVIDERS: OAuthProviderName[] = ['google', 'github', 'gitlab'];

const SECONDARY_PROVIDERS: OAuthProviderName[] = ['microsoft', 'bitbucket', 'oracle'];

/**
 * Auth0 connection names for the standard social buttons. These are Auth0's
 * defaults; a renamed connection in the tenant must be updated here.
 */
const AUTH0_CONNECTIONS: Partial<Record<OAuthProviderName, string>> = {
  google: 'google-oauth2',
  github: 'github',
  gitlab: 'gitlab',
};

const PROVIDER_LABEL: Record<OAuthProviderName, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  google: 'Google',
  microsoft: 'Microsoft',
  bitbucket: 'Bitbucket',
  auth0: 'Auth0',
  oracle: 'Oracle',
};

/** `REPOVERIX_<PREFIX>_OAUTH_CLIENT_ID` / `..._SECRET` for the setup dialog. */
const OAUTH_ENV_PREFIX: Record<OAuthProviderName, string> = {
  github: 'GITHUB',
  gitlab: 'GITLAB',
  google: 'GOOGLE',
  microsoft: 'MICROSOFT',
  bitbucket: 'BITBUCKET',
  auth0: 'AUTH0',
  oracle: 'ORACLE',
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
    case 'auth0':
      return <Auth0Icon className="size-4" />;
    case 'oracle':
      return <OracleIcon className="size-4" />;
    default:
      return null;
  }
}

export function OAuthButtons({ next = '/dashboard' }: { next?: string }) {
  const providers = useOAuthProviders();
  const [pending, setPending] = React.useState<string | null>(null);
  const [setupProvider, setSetupProvider] = React.useState<OAuthProviderName | null>(null);
  const [copied, setCopied] = React.useState(false);

  const available = React.useCallback(
    (provider: OAuthProviderName) => {
      const info = providers.data?.[provider];
      return Boolean(info?.configured && info.supports_signin);
    },
    [providers.data],
  );

  const auth0Available = available('auth0');
  const loading = providers.isLoading;

  const primary = PRIMARY_PROVIDERS.map((provider) => {
    const direct = available(provider);
    // Federating through Auth0 still opens a real consent screen, so the
    // button is live — it just uses the tenant's connection.
    const connection = !direct && auth0Available ? AUTH0_CONNECTIONS[provider] : undefined;
    return { provider, connection, ready: direct || Boolean(connection) };
  });

  const secondary = SECONDARY_PROVIDERS.filter(available);
  const anySetup = primary.some((item) => !item.ready);

  function start(provider: OAuthProviderName, connection?: string) {
    setPending(connection ? `auth0:${provider}` : provider);
    // Full-page navigation: the provider must return to the backend callback,
    // which owns the OAuth state cookie.
    window.location.href = connection
      ? oauthService.loginUrl('auth0', next, { connection })
      : oauthService.loginUrl(provider, next);
  }

  const setupTarget = setupProvider;
  const setupLabel = setupTarget ? PROVIDER_LABEL[setupTarget] : '';
  const callbackUrl = setupTarget ? oauthService.callbackUrl(setupTarget) : '';

  React.useEffect(() => {
    setCopied(false);
  }, [setupProvider]);

  async function copyCallbackUrl() {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-[12px] text-muted">or continue with</span>
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-4 space-y-2">
        {primary.map(({ provider, connection, ready }) => {
          const label = PROVIDER_LABEL[provider];
          const key = connection ? `auth0:${provider}` : provider;
          return (
            <Button
              key={provider}
              variant="secondary"
              size="md"
              className="w-full justify-start"
              disabled={loading}
              loading={pending === key}
              aria-label={
                ready
                  ? `Continue with ${label}`
                  : `${label} sign-in is not configured on this deployment — see setup steps`
              }
              onClick={() => (ready ? start(provider, connection) : setSetupProvider(provider))}
            >
              <ProviderIcon provider={provider} />
              <span>Continue with {label}</span>
              {!loading && !ready ? (
                <span className="ml-auto rounded-sm bg-surface px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.07em] text-faint">
                  Setup
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {auth0Available || secondary.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {auth0Available ? (
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              loading={pending === 'auth0'}
              onClick={() => {
                setPending('auth0');
                window.location.href = oauthService.loginUrl('auth0', next);
              }}
            >
              <ProviderIcon provider="auth0" />
              {PROVIDER_LABEL.auth0}
            </Button>
          ) : null}
          {secondary.map((provider) => (
            <Button
              key={provider}
              variant="secondary"
              size="md"
              className="flex-1"
              loading={pending === provider}
              onClick={() => start(provider)}
            >
              <ProviderIcon provider={provider} />
              {PROVIDER_LABEL[provider]}
            </Button>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[12px] leading-relaxed text-muted" role="status">
        {loading ? (
          'Checking which providers this deployment has configured…'
        ) : providers.isError ? (
          <>
            Provider status could not be read.{' '}
            <button
              type="button"
              className="text-accent underline-offset-4 hover:underline"
              onClick={() => void providers.refetch()}
            >
              Try again
            </button>
          </>
        ) : anySetup ? (
          'A button marked Setup opens the steps needed to switch that provider on. Email and password sign-in works either way.'
        ) : null}
      </p>

      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
        <Tooltip label="The provider returns you to this deployment's callback, which hands the session back to the app.">
          <span className="cursor-help underline decoration-dotted underline-offset-4">
            How this works
          </span>
        </Tooltip>
      </p>

      <Dialog
        open={Boolean(setupProvider)}
        onOpenChange={(open) => {
          if (!open) setSetupProvider(null);
        }}
      >
        {setupTarget ? (
          <DialogContent
            title={`${setupLabel} sign-in is not set up`}
            description={
              providers.isError
                ? `Provider status could not be read from the API, so this button cannot start a sign-in right now. Retry the status check, or configure ${setupLabel} as described below.`
                : `This deployment has no ${setupLabel} OAuth app yet, so there is no consent screen to open. Nothing is broken: email and password sign-in still works.`
            }
            footer={
              <Button variant="secondary" size="md" onClick={() => void copyCallbackUrl()}>
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied ? 'Redirect URI copied' : 'Copy redirect URI'}
              </Button>
            }
          >
            <ol className="space-y-3 text-[13px] leading-relaxed text-body">
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] text-muted">
                  1
                </span>
                <span>Create an OAuth app in {setupLabel}&apos;s developer settings.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] text-muted">
                  2
                </span>
                <span>
                  Register this redirect URI, character for character:
                  <code className="mt-1.5 block break-all rounded-sm border border-hairline bg-surface px-2 py-1.5 font-mono text-[11.5px] text-ink">
                    {callbackUrl}
                  </code>
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] text-muted">
                  3
                </span>
                <span>
                  Set{' '}
                  <code className="font-mono text-[11.5px] text-ink">
                    REPOVERIX_{OAUTH_ENV_PREFIX[setupTarget]}_OAUTH_CLIENT_ID
                  </code>{' '}
                  and{' '}
                  <code className="font-mono text-[11.5px] text-ink">
                    REPOVERIX_{OAUTH_ENV_PREFIX[setupTarget]}_OAUTH_CLIENT_SECRET
                  </code>{' '}
                  on the API, then restart it.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] text-muted">
                  4
                </span>
                <span>Reload this page. The button starts the real consent screen.</span>
              </li>
            </ol>
          </DialogContent>
        ) : null}
      </Dialog>
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
