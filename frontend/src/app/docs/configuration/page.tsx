import type { Metadata } from 'next';
import { H1, H2, P, C, Ol, Li, Callout, DocLink, DocTable } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Configuration',
  description: 'Environment variables, security knobs, sandbox limits and LLM provider configuration for self-hosted RepoVeriX.',
  alternates: { canonical: '/docs/configuration' },
};

export default function DocsConfigurationPage() {
  return (
    <>
      <H1>Configuration &amp; keys</H1>
      <P lead>
        Everything is configured through environment variables prefixed{' '}
        <C>REPOVERIX_</C>, loaded from a <C>.env</C> file in the backend directory (see{' '}
        <C>backend/.env.example</C>). Secrets live only in server-side environment variables — they
        are never exposed to the frontend, logged, or passed into sandboxed repositories.
      </P>

      <H2 id="core">Core settings</H2>
      <DocTable
        head={['Variable', 'Default', 'Purpose']}
        rows={[
          [<C key="1">REPOVERIX_DATABASE_URL</C>, <C key="2">postgresql+asyncpg://repoverix:repoverix@localhost:5432/repoverix</C>, 'Async SQLAlchemy URL. Use sqlite+aiosqlite:///./data/dev.db for local development.'],
          [<C key="3">REPOVERIX_AUTO_CREATE_TABLES</C>, <C key="4">true</C>, 'Create tables at startup (SQLite/dev convenience). With PostgreSQL run alembic upgrade head instead.'],
          [<C key="5">REPOVERIX_JWT_SECRET</C>, <C key="6">change-me-in-production</C>, 'Signs access tokens. Set a strong random value in production.'],
          [<C key="7">REPOVERIX_ACCESS_TOKEN_EXPIRE_MINUTES</C>, <C key="8">1440</C>, 'Access-token lifetime in minutes.'],
          [<C key="9">REPOVERIX_CORS_ORIGINS</C>, <C key="10">{'["http://localhost:3000"]'}</C>, 'Allowed browser origins.'],
          [<C key="11">REPOVERIX_ALLOWED_HOSTS</C>, <C key="12">{'["localhost", "127.0.0.1"]'}</C>, 'Hostnames whose Host header is accepted. Requests from any other host are rejected with 403 (DNS-rebinding / host-header-poisoning defence). Leave empty to accept every host.'],
          [<C key="13">REPOVERIX_EXPOSE_API_DOCS</C>, <C key="14">false</C>, 'Serve /docs, /redoc and /openapi.json. Kept off in production because they expose the full internal route/schema surface; debug=true also enables them.'],
          [<C key="15">REPOVERIX_REPOSITORY_STORAGE_DIR</C>, <C key="16">./data/repositories</C>, 'Where cloned/extracted repository working copies are stored.'],
          [<C key="17">REPOVERIX_API_PREFIX</C>, <C key="18">/api/v1</C>, 'Base path for all API routes.'],
        ]}
      />

      <H2 id="llm">LLM provider (optional)</H2>
      <P>
        Without a key the product still works — static analysis, code health, attack paths,
        evidence validation and repair verification are all deterministic. Configuring a provider
        unlocks LLM reasoning over candidates, wiki prose, and LLM-generated tests.
      </P>
      <DocTable
        head={['Variable', 'Purpose']}
        rows={[
          [<C key="1">REPOVERIX_LLM_PROVIDER</C>, 'openai (default) or anthropic.'],
          [<C key="2">REPOVERIX_LLM_MODEL</C>, 'Model id, e.g. gpt-4o-mini or claude-sonnet.'],
          [<C key="3">REPOVERIX_OPENAI_API_KEY</C>, 'OpenAI (or any OpenAI-compatible endpoint) key.'],
          [<C key="4">REPOVERIX_OPENAI_BASE_URL</C>, 'Override the endpoint — use with local/self-hosted OpenAI-compatible servers.'],
          [<C key="5">REPOVERIX_ANTHROPIC_API_KEY</C>, 'Anthropic key.'],
        ]}
      />
      <Callout kind="warn">
        LLM keys are never passed into sandboxed repositories and are redacted from logs and
        prompts. Repository content is untrusted input — it can never change the system analysis
        instructions.
      </Callout>

      <H2 id="oauth">OAuth &amp; social sign-in</H2>
      <P>
        Email sign-up works out of the box. For GitHub, Google and GitLab sign-in create an OAuth
        app on each provider, then set the matching variables:
      </P>
      <DocTable
        head={['Variable', 'Purpose']}
        rows={[
          [<C key="1">REPOVERIX_GITHUB_CLIENT_ID / _SECRET</C>, 'GitHub OAuth app — used for sign-in and for authenticating repo/PR operations.'],
          [<C key="2">REPOVERIX_GOOGLE_CLIENT_ID / _SECRET</C>, 'Google OAuth (web application) for sign-in.'],
          [<C key="3">REPOVERIX_GITLAB_CLIENT_ID / _SECRET</C>, 'GitLab OAuth application for sign-in and repo import.'],
          [<C key="4">REPOVERIX_FRONTEND_URL</C>, 'The frontend origin used when building OAuth redirect URLs (defaults to http://localhost:3000).'],
        ]}
      />
      <P>
        Authorized redirect URIs must point at the backend callback, e.g.{' '}
        <C>http://localhost:8000/api/v1/oauth/{'{provider}'}/callback</C>. The GitHub client also
        enables the <DocLink href="/docs/features#change">pull-request auditor</DocLink> to fetch
        PR metadata on the user&apos;s behalf.
      </P>

      <H2 id="billing">Billing (Stripe)</H2>
      <DocTable
        head={['Variable', 'Purpose']}
        rows={[
          [<C key="1">REPOVERIX_STRIPE_SECRET_KEY</C>, 'Server-side Stripe key for checkout sessions and webhooks. When unset the billing UI runs in demo mode.'],
          [<C key="2">REPOVERIX_STRIPE_WEBHOOK_SECRET</C>, 'Webhook signature secret for subscription events.'],
          [<C key="3">REPOVERIX_STRIPE_PRICE_*</C>, 'Price IDs for the pro/team plans.'],
        ]}
      />

      <H2 id="sandbox">Sandbox &amp; safety limits</H2>
      <DocTable
        head={['Variable', 'Default', 'Purpose']}
        rows={[
          [<C key="1">REPOVERIX_SANDBOX_CPU_LIMIT</C>, <C key="2">1.0</C>, 'CPU limit for verification containers.'],
          [<C key="3">REPOVERIX_SANDBOX_MEMORY_LIMIT</C>, <C key="4">1g</C>, 'Memory limit for verification containers.'],
          [<C key="5">REPOVERIX_SANDBOX_TIMEOUT_SECONDS</C>, <C key="6">600</C>, 'Timeout for sandboxed test/verification runs.'],
          [<C key="7">REPOVERIX_SANDBOX_PIDS_LIMIT</C>, <C key="8">256</C>, 'Max processes a verification container may spawn (fork-bomb guard).'],
          [<C key="9">REPOVERIX_SANDBOX_NETWORK</C>, <C key="10">bridge</C>, 'Container network: bridge for dependency installs, none to fully isolate.'],
        ]}
      />
      <Callout kind="warn">
        Patch verification and generated tests execute untrusted code. In production these must run
        inside the Docker sandbox with the resource limits above — never directly on the host.
      </Callout>

      <H2 id="http-security">HTTP security hardening</H2>
      <P>
        Every response carries <C>X-Content-Type-Options: nosniff</C>,{' '}
        <C>X-Frame-Options: DENY</C>, <C>Referrer-Policy: no-referrer</C> and a restrictive{' '}
        <C>Permissions-Policy</C> — the same set is applied to the Next.js frontend responses. The
        API rejects requests whose <C>Host</C> header is not in{' '}
        <C>REPOVERIX_ALLOWED_HOSTS</C>, and interactive docs are gated behind{' '}
        <C>REPOVERIX_EXPOSE_API_DOCS</C>. Outbound clones and archive downloads are guarded against
        SSRF (<C>REPOVERIX_SSRF_ALLOW_PRIVATE_HOSTS</C> stays false), and OAuth tokens are encrypted
        at rest with <C>REPOVERIX_TOKEN_ENCRYPTION_KEY</C>. Run <C>python scripts/backup.py</C> on a
        schedule to snapshot the database (<C>REPOVERIX_BACKUP_DIR</C>).
      </P>
      <Callout kind="warn">
        In production set <C>REPOVERIX_ALLOWED_HOSTS</C> to your real public hostname(s){' '}
        (e.g. <C>{'["api.repoverix.dev"]'}</C>), generate and set <C>REPOVERIX_TOKEN_ENCRYPTION_KEY</C>, and keep
        <C>REPOVERIX_EXPOSE_API_DOCS</C> off.
      </Callout>

      <H2 id="checklist">Production checklist</H2>
      <Ol>
        <Li>Set a strong <C>REPOVERIX_JWT_SECRET</C> (never the default).</Li>
        <Li>Set <C>REPOVERIX_ALLOWED_HOSTS</C> to your real public hostname(s).</Li>
        <Li>Generate and set <C>REPOVERIX_TOKEN_ENCRYPTION_KEY</C> so OAuth tokens are encrypted at rest.</Li>
        <Li>Keep <C>REPOVERIX_SSRF_ALLOW_PRIVATE_HOSTS</C> false and <C>REPOVERIX_EXPOSE_API_DOCS</C> off.</Li>
        <Li>Schedule <C>python scripts/backup.py</C> (cron / Task Scheduler) for database backups.</Li>
        <Li>Point <C>REPOVERIX_DATABASE_URL</C> at PostgreSQL and run <C>alembic upgrade head</C>.</Li>
        <Li>Add the LLM provider key you plan to use.</Li>
        <Li>Register OAuth apps (GitHub, Google, GitLab) and set their variables.</Li>
        <Li>Add Stripe keys and price IDs if you are charging.</Li>
        <Li>Set <C>REPOVERIX_CORS_ORIGINS</C> to your real frontend origin.</Li>
        <Li>Deploy with Docker Compose (<C>docker compose up --build</C>) and verify the sandbox can launch containers on the host.</Li>
        <Li>Confirm secrets never appear in logs or exported reports (see Security in the footer docs).</Li>
      </Ol>
      <P>
        A human-run setup walkthrough lives in the repository root under{' '}
        <C>MANUAL-SETUP.md</C> — it lists every account and key an operator must create, since no
        code can do that for you.
      </P>
    </>
  );
}
