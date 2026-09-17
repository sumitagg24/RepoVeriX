import type { Metadata } from 'next';
import { H1, H2, P, Ul, Li, Callout, DocLink, Code } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Account security',
  description:
    'How RepoVeriX authentication works: email verification, password policy, temporary lockouts, session revocation, provider connections and the identity webhook contract.',
  alternates: { canonical: '/docs/account-security' },
};

export default function AccountSecurityPage() {
  return (
    <>
      <H1>Account security</H1>
      <P lead>
        How RepoVeriX authenticates you, protects your account, and keeps <strong>authentication</strong>{' '}
        (who you are) strictly separate from <strong>authorization</strong> (what you can access).
      </P>

      <Callout kind="info">
        The short version: signing in proves who you are. It grants <em>nothing</em> else. Access to
        repositories requires an explicit provider connection (Connect GitHub / Connect GitLab), and
        every repository operation is re-checked server-side against that connection.
      </Callout>

      <H2 id="email-verification">Email verification</H2>
      <P>
        Password accounts must verify their email before they can sign in. The verification link is
        a one-time token — it expires in 24 hours and works exactly once. Until verification, the
        account cannot connect providers, register repositories or start scans; the API returns a
        clear <Code>EMAIL_NOT_VERIFIED</Code> error and the frontend shows what to do next.
      </P>
      <P>
        Did not get the email? Use <Code>/auth/verify-email</Code>&apos;s resend option or ask for a
        new link from the sign-in flow. Resends are rate limited to prevent abuse. Accounts created
        through Google, GitHub or GitLab sign-in are verified automatically — the provider already
        proved control of the address.
      </P>

      <H2 id="password-policy">Password policy</H2>
      <Ul>
        <Li>
          Minimum 8 characters; longer passphrases are strongly recommended. No arbitrary
          &quot;one symbol, one number&quot; rules.
        </Li>
        <Li>
          Common and breached passwords are rejected server-side at signup, password change and
          reset. When breach screening is enabled, only a 5-character hash prefix of your password
          is ever sent to the screening service — never the password itself.
        </Li>
        <Li>
          Passwords are hashed with bcrypt. RepoVeriX never logs, exports or transmits your
          password.
        </Li>
      </Ul>

      <H2 id="password-reset">Password reset</H2>
      <P>
        <DocLink href="/auth/forgot-password">Forgot password</DocLink> sends a one-time reset link
        that expires in 60 minutes. The response is identical whether or not the address has an
        account — the password-reset flow cannot be used to find out who has an account here.
        Setting a new password <strong>signs out every other session</strong> immediately, so a
        stolen session cannot survive a recovery.
      </P>

      <H2 id="lockouts">Temporary lockouts</H2>
      <P>
        Repeated failed sign-ins trigger a <em>temporary</em> cooldown on the account — never a
        permanent lock. The cooldown grows with repeated failures and clears after a successful
        sign-in (or a verified email). If you see &quot;Too many unsuccessful attempts&quot;, wait a
        few minutes and try again; a password reset is always available.
      </P>

      <H2 id="sessions">Sessions and sign-out</H2>
      <Ul>
        <Li>Access tokens are short-lived JWTs signed server-side; nothing sensitive is stored in the browser beyond the token itself.</Li>
        <Li>Changing your password or completing a password reset revokes all existing sessions (a token-version check enforced on every request).</Li>
        <Li>Suspended or deleted accounts are locked out immediately, including via the identity webhook path.</Li>
      </Ul>

      <H2 id="providers">Provider connections ≠ sign-in</H2>
      <P>
        Signing in with Google does not give RepoVeriX access to your GitHub or GitLab — and signing
        in with GitHub does not automatically import repositories. These are separate grants:
      </P>
      <Ul>
        <Li>
          <strong>Authentication</strong>: who you are (email/password or a social sign-in).
        </Li>
        <Li>
          <strong>Provider authorization</strong>: an explicit &quot;Connect GitHub&quot;/&quot;Connect
          GitLab&quot; flow you complete separately, with least-privilege scopes shown on the{' '}
          <DocLink href="/integrations/github">integration pages</DocLink>.
        </Li>
        <Li>
          <strong>Repository authorization</strong>: every import, scan and patch is checked
          server-side against your user and the connection that owns it.
        </Li>
      </Ul>
      <P>
        Disconnecting a provider revokes the stored token, blocks provider operations immediately
        and is recorded in your account&apos;s security event log. Existing scan history follows the{' '}
        <DocLink href="/privacy">data-retention policy</DocLink>.
      </P>

      <H2 id="audit">Security event log</H2>
      <P>
        Sign-ins, failures, lockouts, password changes, verification and provider connect/disconnect
        events are recorded in an audit trail your <Code>/settings</Code> security view surfaces.
        Events store who/what/when metadata only — never passwords, tokens or cookies.
      </P>

      <H2 id="webhooks">Identity webhook (self-hosted deployments)</H2>
      <P>
        When RepoVeriX is deployed behind an external identity provider, that provider can push user
        lifecycle events (created / updated / deleted) to <Code>/api/v1/auth/webhooks/user-sync</Code>.
        The contract:
      </P>
      <Ul>
        <Li>The sender signs the raw body with HMAC-SHA256 using <Code>REPOVERIX_AUTH_WEBHOOK_SECRET</Code> and sends it as <Code>X-RVX-Signature</Code>.</Li>
        <Li>Delivery is at-least-once: event IDs are recorded and replays are absorbed as duplicates.</Li>
        <Li>Out-of-order events are tolerated; unknown users on updates are recorded and ignored.</Li>
        <Li>A <Code>user.deleted</Code> event deactivates the account and revokes its sessions.</Li>
      </Ul>

      <Callout kind="info">
        Questions about a specific event on your account? <DocLink href="/help/contact">Contact
        support</DocLink> with the approximate time — the audit trail lets us look up exactly what
        happened without asking you for anything sensitive.
      </Callout>
    </>
  );
}
