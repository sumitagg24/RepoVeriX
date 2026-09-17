'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'repoverix-cookie-consent';

type Consent = 'accepted' | 'rejected' | null;

function readConsent(): Consent {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'accepted' || value === 'rejected' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Cookie / analytics consent banner. Shown once per visitor until they choose.
 * "Accept" allows non-essential analytics cookies; "Reject" stores the choice
 * and loads no tracking at all. The choice is stored locally and can be
 * changed any time from the settings page.
 */
export function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (stored === null) {
      const timer = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timer);
    }
    setConsent(stored);
  }, []);

  const choose = (value: 'accepted' | 'rejected') => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* private mode — nothing to persist */
    }
    setConsent(value);
    setVisible(false);
  };

  if (!visible || consent !== null) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[90] sm:left-auto sm:right-6 sm:max-w-md animate-rise"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="rounded-2xl border bg-card/95 p-5 shadow-xl shadow-foreground/10 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold leading-tight">We value your privacy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We use essential cookies to keep you signed in and secure. With your
              permission we also use analytics cookies to understand how the
              product is used. You can change this any time in Settings.
            </p>
          </div>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => choose('rejected')}
            aria-label="Reject non-essential cookies"
            title="Reject non-essential cookies"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => choose('accepted')}>
            Accept all
          </Button>
          <Button size="sm" variant="outline" onClick={() => choose('rejected')}>
            Reject non-essential
          </Button>
          <Link
            href="/privacy"
            className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Privacy policy
          </Link>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground/80">
          RepoVeriX loads no analytics or tracking until you accept. Essential
          cookies (sign-in session, security) always apply.
        </p>
      </div>
    </div>
  );
}