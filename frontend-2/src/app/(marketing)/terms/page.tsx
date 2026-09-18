import type { Metadata } from 'next';

import { CalloutNote, Prose } from '@/components/marketing/prose';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Terms',
  description:
    'Terms for using RepoVeriX: account responsibilities, plan limits, what detection output does and does not guarantee, and how access ends.',
  path: '/terms',
  keywords: ['terms of service', 'acceptable use'],
});

export default function TermsPage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Terms
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          The working agreement for using RepoVeriX, written to match what the software actually does,
          including what it does not promise about security outcomes.
        </p>
        <p className="mt-3 text-[12.5px] text-muted">Last updated 18 September 2026.</p>
      </header>

      <CalloutNote title="Review before relying on this">
        This text documents how the deployed product behaves so it can be checked against the running
        system. It is not a signed agreement; publish a version reviewed by counsel for your jurisdiction.
      </CalloutNote>

      <Prose className="mt-10">
        <h2>Using the service</h2>
        <p>
          You need an account, a verified email for password sign-ins, and the right to analyse the
          repositories you import. Importing a repository you do not have permission to read is a breach of
          these terms, not a configuration mistake.
        </p>

        <h2>Your content</h2>
        <p>
          You keep ownership of your source code and everything derived from it. Operating the product
          requires a license to store and process a snapshot of the repositories you import, run scans over
          them, store the resulting findings and patches, and run candidate patches inside an isolated
          sandbox for verification. That license exists only to provide the service.
        </p>

        <h2>Plans, limits and billing</h2>
        <ul>
          <li>
            Each plan carries concrete limits: repositories, scans per month, generated fixes,
            verifications, collaborator seats. Usage is measured per billing period and shown in the
            interface.
          </li>
          <li>
            An action beyond a limit is refused with <code>402</code> and the reason, the product does not
            silently degrade a scan to fit an entitlement.
          </li>
          <li>
            Deployments without billing-provider keys run in demo mode, where activation is recorded
            locally. The interface labels that state instead of presenting it as a purchase.
          </li>
          <li>Cancel at any time through the billing portal. Access continues to the end of the paid period.</li>
        </ul>

        <h2>What detection output means</h2>
        <p>
          Findings, severities, confidences and verdicts are analysis results, not statements of fact about
          your security posture.
        </p>
        <ul>
          <li>
            An empty scan means the detectors produced no chains for the configurations that ran. It is not
            a clean bill of health.
          </li>
          <li>
            <em>Verified repair</em> means the recorded checks executed and passed for that patch. It does
            not mean the change is free of other defects.
          </li>
          <li>
            Model-assisted output can be wrong. It is labelled by source, and a plan that includes it can
            also turn it off.
          </li>
          <li>
            No warranty is offered that the service finds any particular class of vulnerability or all
            instances of one.
          </li>
        </ul>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not import repositories you have no right to inspect.</li>
          <li>Do not attack the service, other accounts, or verification infrastructure.</li>
          <li>Do not use the sandbox to run code unrelated to verifying a finding you own.</li>
          <li>Do not resell scan output as an independent security attestation.</li>
        </ul>

        <h2>Availability and changes</h2>
        <p>
          Scans run in the background and can fail. The interface reports failures with their cause rather
          than hiding them, and a failed scan is retryable. Features may change; anything that changes what
          is stored is reflected on the <a href="/privacy">privacy page</a>.
        </p>

        <h2>Ending access</h2>
        <p>
          You can delete repositories, disconnect providers, and delete your account from settings, which
          removes the data attached to it. Accounts that import content they have no right to, attack the
          service, or attempt to bypass plan limits may be suspended, with the reason recorded.
        </p>

        <h2>Liability</h2>
        <p>
          The service is provided as it is. To the extent your jurisdiction allows, liability is limited to
          the amount paid for the affected period, and no liability is accepted for missed vulnerabilities,
          for decisions made on the basis of analysis output, or for costs arising from the code changes you
          choose to make.
        </p>

        <h2>Contact</h2>
        <p>
          Terms questions belong with whoever operates this deployment. Product behaviour questions are
          answered in the <a href="/docs/faq">FAQ</a> and the <a href="/docs/api">API reference</a>.
        </p>
      </Prose>
    </>
  );
}
