'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BadgeCheck, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/api';
import { AuthShell } from '@/components/auth-shell';

type VerifyState = 'verifying' | 'verified' | 'invalid';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>('verifying');
  const [resendEmail, setResendEmail] = useState('');
  const [resent, setResent] = useState(false);

  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';

  useEffect(() => {
    let cancelled = false;
    if (!uid || !token) {
      setState('invalid');
      return;
    }
    authService
      .verifyEmail(uid, token)
      .then(() => {
        if (!cancelled) setState('verified');
      })
      .catch(() => {
        if (!cancelled) setState('invalid');
      });
    return () => {
      cancelled = true;
    };
  }, [uid, token]);

  const resend = async () => {
    if (!resendEmail) return;
    try {
      const result = await authService.resendVerification(resendEmail);
      // Console mail backend (dev): no real email is sent, so completing the
      // loop matters more than enumeration paranoia — go verify directly.
      if (result?.dev_verification_url) {
        const url = new URL(result.dev_verification_url);
        window.location.href = `${url.pathname}${url.search}`;
        return;
      }
      setResent(true);
    } catch {
      // Same response either way — no information leaks.
      setResent(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center" role="status">
      {state === 'verifying' && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
        </>
      )}
      {state === 'verified' && (
        <>
          <BadgeCheck className="h-12 w-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <p className="font-medium">Your email is verified.</p>
          <p className="text-sm text-muted-foreground">
            Repository connections, scans and verified repairs are now unlocked.
          </p>
          <Button asChild className="mt-2">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </>
      )}
      {state === 'invalid' && (
        <>
          <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
          <p className="font-medium">This link didn&apos;t work</p>
          <p className="text-sm text-muted-foreground">
            This link is invalid or has expired. If you still need to verify, enter your email and
            we&apos;ll send a fresh link.
          </p>
          {resent ? (
            <p className="text-sm text-muted-foreground">
              If an account exists for this email, you&apos;ll receive a message with the next
              steps shortly.
            </p>
          ) : (
            <div className="flex w-full max-w-xs gap-2">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                aria-label="Email address"
              />
              <Button type="button" variant="outline" onClick={resend} disabled={!resendEmail}>
                Resend
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Email verification"
      subtitle="One click unlocks scans, evidence and verified repairs"
      footer={
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
