import type { Metadata } from 'next';

import { CalloutNote, Prose } from '@/components/marketing/prose';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy',
  description:
    'What RepoVeriX stores, why each category exists, who processes it, how long it is kept, and how to export or delete it.',
  path: '/privacy',
  keywords: ['privacy', 'data handling', 'repository snapshot retention'],
});

const UPDATED = '18 September 2026';

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Privacy
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          A security product asks for access to source code, so the data section deserves to be specific.
          This page lists what this deployment stores, why each category exists, and what removes it.
        </p>
        <p className="mt-3 text-[12.5px] text-muted">Last updated {UPDATED}.</p>
      </header>

      <CalloutNote title="Read this as a description, not as a contract">
        The text below describes how this deployment behaves and is provided so reviewers can check it
        against the running system. It is not a substitute for a reviewed legal agreement; publication
        should be signed off by counsel for the jurisdiction you operate in.
      </CalloutNote>

      <Prose className="mt-10">
        <h2>What is stored</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Why it exists</th>
              <th>Removed by</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Account record</td>
              <td>Email, name, password hash, plan, verification and creation timestamps.</td>
              <td>Deleting the account</td>
            </tr>
            <tr>
              <td>Repository snapshot</td>
              <td>
                A copy of the repository at import time. Scans read the snapshot so a result is
                reproducible and a run never touches your working copy.
              </td>
              <td>Deleting the repository</td>
            </tr>
            <tr>
              <td>Scan output</td>
              <td>
                Findings, their evidence chains, stage timings and logs. This is the product’s working
                record.
              </td>
              <td>Deleting the repository</td>
            </tr>
            <tr>
              <td>Candidate patches and verification runs</td>
              <td>Diffs, executed checks and their outcomes, so a verdict can be audited or re-run.</td>
              <td>Deleting the finding or the repository</td>
            </tr>
            <tr>
              <td>Account activity</td>
              <td>Sign-in, password and session events, used for the security overview.</td>
              <td>Deleting the account</td>
            </tr>
            <tr>
              <td>Analyst feedback</td>
              <td>Your verdict on a finding, used to report detection quality in your own workspace.</td>
              <td>Withdrawing the feedback, or deleting the account</td>
            </tr>
            <tr>
              <td>Provider tokens</td>
              <td>
                OAuth access tokens for connected providers, needed to list and import repositories.
              </td>
              <td>Disconnecting the provider</td>
            </tr>
          </tbody>
        </table>

        <h2>What is not done with it</h2>
        <ul>
          <li>Repository content is not used to train models.</li>
          <li>Snapshots are not shared between accounts.</li>
          <li>Snapshots are not written back into your repositories or branches.</li>
          <li>There is no advertising or behavioural analytics integration in this interface.</li>
        </ul>

        <h2>Model providers</h2>
        <p>
          Model-assisted configurations send the code context a stage needs to the provider configured for
          the deployment, so reasoning and patch generation can run. Deployments that only run{' '}
          <code>static_only</code> send nothing. Which configurations ran is recorded on each scan, and
          findings derived from a model call are labelled with their source.
        </p>

        <h2>Cookies and local storage</h2>
        <p>
          The interface stores three things in your browser: the access token for the API session, your
          colour-scheme preference, and whether the sidebar is collapsed. There are no third-party
          analytics or advertising cookies.
        </p>

        <h2>Retention</h2>
        <p>
          Data stays until you remove it. A repository and everything derived from it are deleted together;
          deleting your account removes the account record and the repositories attached to it. Uploaded
          archives are validated by content before use and are dropped if they are not valid archives.
        </p>

        <h2>Your controls</h2>
        <ul>
          <li>
            <strong>Export</strong>, <code>GET /api/v1/auth/me/export</code> returns your account data as
            JSON. Reports and findings export as SARIF or Markdown at any time.
          </li>
          <li>
            <strong>Delete</strong>, repository deletion is in the repository detail page; account
            deletion is in settings.
          </li>
          <li>
            <strong>Revoke</strong>, revoking all sessions invalidates every issued token immediately,
            including ones on other devices.
          </li>
          <li>
            <strong>Disconnect</strong>, removing a provider connection deletes the stored token and keeps
            the repositories you already imported.
          </li>
        </ul>

        <h2>Security practices</h2>
        <p>
          Passwords are stored as hashes, never as text. Sessions are stateless bearer tokens that can be
          revoked in bulk. Verification runs inside an isolated container with no access to the host
          filesystem beyond the sandbox. Personal API tokens are shown once at creation and stored hashed.
        </p>

        <h2>Questions</h2>
        <p>
          Security and privacy questions about a specific deployment belong with whoever operates it; the
          interface cannot answer questions about infrastructure it does not own. For product behaviour, the{' '}
          <a href="/docs/faq">FAQ</a> and the <a href="/docs/api">API reference</a> are the accurate
          sources.
        </p>
      </Prose>
    </>
  );
}
