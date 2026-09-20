'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const COOKIE_CONSENT_KEY = 'repoverix.cookie-consent';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        setShowBanner(true);
      }
    } catch {
      // Ignore localStorage unavailable
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ essential: true, analytics: true, timestamp: Date.now() }));
    } catch {}
    setShowBanner(false);
  };

  const handleReject = () => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ essential: true, analytics: false, timestamp: Date.now() }));
    } catch {}
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <aside
      aria-label="Cookie preferences"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-xl border border-hairline bg-surface/95 p-4 shadow-xl backdrop-blur-md transition-all sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md"
    >
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Cookie & Privacy Preferences</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-body">
            We use essential cookies to maintain sessions and optional anonymous analytics to measure platform performance. Read our{' '}
            <Link href="/privacy" className="text-accent underline underline-offset-2 hover:opacity-80">
              Privacy Policy
            </Link>.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={handleReject}>
            Essential only
          </Button>
          <Button variant="primary" size="sm" onClick={handleAccept}>
            Accept all
          </Button>
        </div>
      </div>
    </aside>
  );
}
