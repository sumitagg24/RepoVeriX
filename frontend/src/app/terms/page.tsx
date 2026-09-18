import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/marketing-shell';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your use of RepoVeriX: acceptable use, subscription billing, data handling and limitation of liability.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="type-display">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: September 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">The service</h2>
            <p className="mt-2">
              RepoVeriX is an evidence-grounded repository auditing platform. It analyzes code you
              provide and generates findings, patches and reports. Analysis output is
              best-effort research software — it is not a substitute for human review.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Patches are never auto-applied</h2>
            <p className="mt-2">
              Generated patches are proposals. They are applied only inside isolated verification
              copies; we never modify your repository or production code automatically.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Fair use</h2>
            <p className="mt-2">
              Plans include monthly quotas for repositories, scans, AI fixes and sandbox
              verifications. Exceeding them blocks the action with an upgrade prompt — never a
              surprise charge.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Liability</h2>
            <p className="mt-2">
              The service is provided “as is” without warranties. To the maximum extent permitted
              by law, RepoVeriX is not liable for damages arising from analysis results, patches,
              or use of the platform. You are responsible for repositories you upload and for
              decisions based on scan output.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-foreground">Changes</h2>
            <p className="mt-2">
              We may update these terms; material changes will be announced in-app or by email.
            </p>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}