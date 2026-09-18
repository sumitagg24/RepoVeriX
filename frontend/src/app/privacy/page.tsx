import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/marketing-shell';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What RepoVeriX collects, how repository data and OAuth tokens are stored and protected, how long data is retained, and how to export or delete your account.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="type-display">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">What we store</h2>
            <p className="mt-2">
              Account information (name, email, password hash), your repositories and their
              analysis results, scan history, and billing status. Repository source code is stored
              on our servers so scans and verifications can run against it.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Cookies</h2>
            <p className="mt-2">
              Essential cookies keep you signed in and secure. Analytics cookies are only used
              with your consent — you can accept or reject them via the banner, and change your
              choice at any time from Settings.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Repository content</h2>
            <p className="mt-2">
              Code you import is treated as untrusted data. It is never sold, shared, or used to
              train models. If you connect an LLM provider, relevant code snippets may be sent to
              that provider solely to produce analysis you request.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Deletion</h2>
            <p className="mt-2">
              Deleting a repository removes its stored source and analysis results. You may
              request full account deletion at any time by contacting support.
            </p>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}