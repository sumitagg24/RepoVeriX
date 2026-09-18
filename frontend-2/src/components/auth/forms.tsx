'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Check, KeyRound, MailCheck, ShieldAlert } from 'lucide-react';

import { AuthError, AuthNotice, AuthShell, OAuthButtons } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Callout } from '@/components/ui/panel';
import { LoadingRegion, SkeletonText } from '@/components/ui/states';
import { useAuth } from '@/context/auth-context';
import { authService, readStoredToken, toApiFailure } from '@/services/api';

/**
 * Account forms.
 *
 * One rule runs through all of them: the API's `detail` string is shown verbatim
 * (it is written for people and is deliberately enumeration-safe), and nothing is
 * invented client-side — no "check your inbox" when the backend did not say so.
 */

const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'That is longer than the API accepts (128 characters).');

// ------------------------------------------------------------------- sign in

const signInSchema = z.object({
  email: z.string().min(1, 'Enter your email.').email('That does not look like an email address.'),
  password: z.string().min(1, 'Enter your password.').max(128),
});

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, user } = useAuth();
  const [failure, setFailure] = React.useState<string | null>(null);
  const expired = params.get('expired') === '1';
  const next = params.get('next') || '/dashboard';

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  React.useEffect(() => {
    if (user) router.replace(next);
  }, [user, router, next]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await login(values.email, values.password);
      router.replace(next);
    } catch (error) {
      const api = toApiFailure(error);
      setFailure(api.message);
      form.resetField('password', { defaultValue: '' });
    }
  });

  return (
    <AuthShell
      title="Sign in to RepoVeriX"
      description="Your workspace: repositories, scans, findings and their verification records."
      footer={
        <>
          No account yet?{' '}
          <Link href="/auth/sign-up" className="text-accent underline-offset-4 hover:underline">
            Create one
          </Link>
          . Password accounts need a verified email before imports and scans open.
        </>
      }
    >
      {expired ? (
        <Callout tone="warning" className="mb-5" title="Your session ended">
          The stored session was rejected by the API. Sign in again to continue where you left off.
        </Callout>
      ) : null}

      {failure ? <AuthError className="mb-5" message={failure} /> : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Work email" error={form.formState.errors.email?.message} required>
          {(props) => (
            <Input
              {...props}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              {...form.register('email')}
            />
          )}
        </Field>

        <Field
          label="Password"
          error={form.formState.errors.password?.message}
          required
          hint={
            <Link href="/auth/forgot-password" className="text-accent underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          }
        >
          {(props) => (
            <Input
              {...props}
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
            />
          )}
        </Field>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      <OAuthButtons next={next} />

      <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
        Signing in with a provider skips the verification step. Nothing is imported until you choose a
        repository.
      </p>
    </AuthShell>
  );
}

// ------------------------------------------------------------------- sign up

const signUpSchema = z.object({
  full_name: z.string().min(1, 'Enter your name.').max(200),
  email: z.string().min(1, 'Enter your email.').email('That does not look like an email address.'),
  password: passwordRule,
  accept: z.literal(true, {
    errorMap: () => ({ message: 'Agree to the terms before creating an account.' }),
  }),
});

export function SignUpForm() {
  const router = useRouter();
  const { signUp, user } = useAuth();
  const [failure, setFailure] = React.useState<string | null>(null);
  const [devUrl, setDevUrl] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: '', email: '', password: '', accept: false as true },
  });

  React.useEffect(() => {
    if (user) router.replace('/onboarding');
  }, [user, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      const result = await signUp(values.email, values.password, values.full_name);
      if (result.dev_verification_url) setDevUrl(result.dev_verification_url);
      router.replace(
        `/auth/verify-email?sent=1&email=${encodeURIComponent(values.email)}${
          result.dev_verification_url ? '&dev=1' : ''
        }`,
      );
    } catch (error) {
      setFailure(toApiFailure(error).message);
    }
  });

  return (
    <AuthShell
      title="Create your account"
      description="One account covers your repositories, scans and findings. The free plan runs real scans with no card and no trial clock."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-accent underline-offset-4 hover:underline">
            Sign in
          </Link>
          .
        </>
      }
    >
      {failure ? <AuthError className="mb-5" message={failure} /> : null}
      {devUrl ? (
        <AuthNotice>
          This deployment runs the console mailer.{' '}
          <a href={devUrl} className="text-accent underline underline-offset-4">
            Open the verification link
          </a>
          .
        </AuthNotice>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" error={form.formState.errors.full_name?.message} required>
          {(props) => (
            <Input {...props} autoComplete="name" autoFocus placeholder="Your name" {...form.register('full_name')} />
          )}
        </Field>

        <Field label="Work email" error={form.formState.errors.email?.message} required>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
          )}
        </Field>

        <Field
          label="Password"
          error={form.formState.errors.password?.message}
          required
          hint="At least 8 characters, not a common password, and not one found in known breach corpora."
        >
          {(props) => (
            <Input {...props} type="password" autoComplete="new-password" {...form.register('password')} />
          )}
        </Field>

        <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-body">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-[var(--tint-accent)]"
            {...form.register('accept')}
          />
          <span>
            I have the right to analyse the repositories I import, and I accept the{' '}
            <Link href="/terms" className="text-accent underline-offset-4 hover:underline">
              terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {form.formState.errors.accept ? (
          <p role="alert" className="text-[12.5px] text-critical">
            {form.formState.errors.accept.message}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>

      <OAuthButtons next="/onboarding" />
    </AuthShell>
  );
}

// ----------------------------------------------------------- forgot password

export function ForgotPasswordForm() {
  const form = useForm<{ email: string }>({
    resolver: zodResolver(
      z.object({ email: z.string().min(1, 'Enter your email.').email('That does not look like an email address.') }),
    ),
    defaultValues: { email: '' },
  });
  const [sent, setSent] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await authService.forgotPassword(values.email);
      setSent(result.detail);
    } catch (error) {
      setSent(toApiFailure(error).message);
    }
  });

  return (
    <AuthShell
      title="Reset your password"
      description="We send a single-use link that expires. The response is the same whether or not an account exists, so this form cannot be used to discover addresses."
      footer={
        <>
          Remembered it?{' '}
          <Link href="/auth/sign-in" className="text-accent underline-offset-4 hover:underline">
            Back to sign in
          </Link>
          .
        </>
      }
    >
      {sent ? (
        <Callout tone="verified" title="Check your email">
          {sent}
        </Callout>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Work email" error={form.formState.errors.email?.message} required>
            {(props) => (
              <Input {...props} type="email" autoComplete="email" autoFocus placeholder="you@company.com" {...form.register('email')} />
            )}
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
        A successful reset invalidates every existing session, including ones on other devices. That is
        deliberate: recovery should never leave an attacker-held session alive.
      </p>
    </AuthShell>
  );
}

// ------------------------------------------------------------ reset password

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';

  const form = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(
      z
        .object({ password: passwordRule, confirm: z.string() })
        .refine((values) => values.password === values.confirm, {
          path: ['confirm'],
          message: 'Both passwords must match.',
        }),
    ),
    defaultValues: { password: '', confirm: '' },
  });
  const [failure, setFailure] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    try {
      await authService.resetPassword(uid, token, values.password);
      router.replace('/auth/sign-in?reset=1');
    } catch (error) {
      setFailure(toApiFailure(error).message);
    }
  });

  if (!uid || !token) {
    return (
      <AuthShell title="Reset link incomplete" description="This link is missing its identifier or its token.">
        <Callout tone="warning" title="Ask for a new link">
          Reset links contain a one-time token. Requesting a new one invalidates the old link.
        </Callout>
        <Button asChild variant="primary" size="lg" className="mt-5 w-full">
          <Link href="/auth/forgot-password">Request a new link</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="This link is single-use. Setting the password also revokes every session issued before now."
    >
      {failure ? <AuthError className="mb-5" message={failure} /> : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="New password"
          error={form.formState.errors.password?.message}
          required
          hint="At least 8 characters. Avoid anything you have used elsewhere."
        >
          {(props) => (
            <Input {...props} type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
          )}
        </Field>
        <Field label="Confirm new password" error={form.formState.errors.confirm?.message} required>
          {(props) => (
            <Input {...props} type="password" autoComplete="new-password" {...form.register('confirm')} />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Set password
        </Button>
      </form>
    </AuthShell>
  );
}

// ------------------------------------------------------------- verify email

type VerifyState = 'idle' | 'verifying' | 'verified' | 'failed' | 'resent';

export function VerifyEmailFlow() {
  const params = useSearchParams();
  const uid = params.get('uid');
  const token = params.get('token');
  const sent = params.get('sent') === '1';
  const emailFromQuery = params.get('email') ?? '';
  const signedIn = Boolean(readStoredToken());
  const { user, refresh } = useAuth();

  const [state, setState] = React.useState<VerifyState>(uid && token ? 'verifying' : 'idle');
  const [detail, setDetail] = React.useState<string | null>(null);
  const [resendEmail, setResendEmail] = React.useState(emailFromQuery || user?.email || '');
  const [devUrl, setDevUrl] = React.useState<string | null>(null);
  const attempted = React.useRef(false);

  React.useEffect(() => {
    if (!uid || !token || attempted.current) return;
    attempted.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const result = await authService.verifyEmail(uid, token);
        if (cancelled) return;
        setDetail(result.detail);
        setState('verified');
        if (signedIn) void refresh();
      } catch (error) {
        if (cancelled) return;
        setDetail(toApiFailure(error).message);
        setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, token, signedIn, refresh]);

  const resend = async () => {
    setDevUrl(null);
    try {
      const result = await authService.resendVerification(resendEmail);
      setDetail(result.detail);
      setDevUrl(result.dev_verification_url ?? null);
      setState('resent');
    } catch (error) {
      setDetail(toApiFailure(error).message);
      setState('failed');
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      description="Imports and scans stay closed until the address is confirmed. Everything else in the workspace is readable."
      footer={
        <>
          {signedIn ? (
            <Link href="/dashboard" className="text-accent underline-offset-4 hover:underline">
              Go to your workspace
            </Link>
          ) : (
            <Link href="/auth/sign-in" className="text-accent underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          )}
        </>
      }
    >
      {state === 'verifying' ? (
        <LoadingRegion label="Verifying your email address" className="panel px-5 py-6">
          <div className="flex items-center gap-3">
            <MailCheck className="size-4 text-accent" aria-hidden="true" />
            <p className="text-[13.5px] text-ink">Checking the verification token…</p>
          </div>
          <SkeletonText lines={2} className="mt-4" />
        </LoadingRegion>
      ) : null}

      {state === 'verified' ? (
        <Callout tone="verified" title="Email verified">
          {detail ?? 'The address is confirmed. Imports and scans are now open.'}
          <div className="mt-4">
            <Button asChild variant="primary" size="md">
              <Link href={signedIn ? '/onboarding' : '/auth/sign-in'}>
                {signedIn ? 'Continue to setup' : 'Sign in'}
              </Link>
            </Button>
          </div>
        </Callout>
      ) : null}

      {state === 'failed' ? (
        <Callout tone="critical" title="That token did not work">
          {detail ?? 'Verification links are single-use and expire. Request a fresh one below.'}
        </Callout>
      ) : null}

      {state === 'idle' || state === 'resent' || state === 'failed' ? (
        <div className={state === 'idle' ? '' : 'mt-6'}>
          {sent && state === 'idle' ? (
            <Callout tone="info" className="mb-5" title="Account created">
              We sent a verification link{emailFromQuery ? ` to ${emailFromQuery}` : ''}. Open it on this
              device or in another tab. The link carries a single-use token.
            </Callout>
          ) : null}
          <Field
            label="Email address"
            hint="Resending issues a fresh token; the previous link stops working."
          >
            {(props) => (
              <Input
                {...props}
                type="email"
                autoComplete="email"
                value={resendEmail}
                onChange={(event) => setResendEmail(event.target.value)}
                placeholder="you@company.com"
              />
            )}
          </Field>
          <Button variant="primary" size="lg" className="mt-4 w-full" onClick={() => void resend()}>
            Resend verification link
          </Button>
          {devUrl ? (
            <Callout tone="accent" className="mt-4" title="Console mailer">
              This deployment prints email instead of sending it.{' '}
              <a href={devUrl} className="text-accent underline underline-offset-4">
                Open the link
              </a>
              .
            </Callout>
          ) : null}
          {state === 'resent' && detail ? (
            <p className="mt-4 text-[13px] text-body">{detail}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex items-start gap-2.5 border-t border-hairline pt-5 text-[12.5px] leading-relaxed text-muted">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
        <p>
          Resend requests are rate limited per account. If nothing arrives, the address may already be
          verified, and signing in will tell you.
        </p>
      </div>
    </AuthShell>
  );
}

// --------------------------------------------------------- oauth callback

/**
 * The provider returns to the backend callback, which then hands the session to
 * this route. The backend places the token in the URL fragment (`#token=…`) so a
 * long-lived credential never lands in a server log or referrer header.
 */
export function OAuthCallback() {
  const [state, setState] = React.useState<'working' | 'failed'>('working');
  const [detail, setDetail] = React.useState<string | null>(null);
  const { adoptToken } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);
      const token = hash.get('token') ?? query.get('token');
      const next = hash.get('next') ?? query.get('next') ?? '/onboarding';
      const error = hash.get('error') ?? query.get('error');

      if (error) {
        if (!cancelled) {
          setDetail(error);
          setState('failed');
        }
        return;
      }
      if (!token) {
        if (!cancelled) {
          setDetail('The provider did not return a session token. Start the sign-in again from this tab.');
          setState('failed');
        }
        return;
      }
      try {
        await adoptToken(token);
        // Drop the token from the address bar before navigating.
        window.history.replaceState(null, '', window.location.pathname);
        if (!cancelled) router.replace(next);
      } catch (err) {
        if (!cancelled) {
          setDetail(toApiFailure(err).message);
          setState('failed');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adoptToken, router]);

  return (
    <AuthShell title="Completing sign-in" description="Handing the provider session back to your workspace.">
      {state === 'working' ? (
        <LoadingRegion label="Completing sign-in" className="panel px-5 py-6">
          <div className="flex items-center gap-3">
            <KeyRound className="size-4 text-accent" aria-hidden="true" />
            <p className="text-[13.5px] text-ink">Validating the provider session…</p>
          </div>
          <SkeletonText lines={2} className="mt-4" />
        </LoadingRegion>
      ) : (
        <>
          <Callout tone="critical" title="Sign-in was not completed">
            {detail}
          </Callout>
          <Button asChild variant="primary" size="lg" className="mt-5 w-full">
            <Link href="/auth/sign-in">
              <Check className="size-4" aria-hidden="true" />
              Back to sign in
            </Link>
          </Button>
        </>
      )}
    </AuthShell>
  );
}
