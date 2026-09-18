import Link from 'next/link';
import type { Metadata } from 'next';

import { CalloutNote, CodeBlock, Prose } from '@/components/marketing/prose';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'API reference',
  description:
    'RepoVeriX API reference: bearer authentication, endpoint groups for repositories, scans, findings, patches, verification, billing and teams, plus plan gates and exports.',
  path: '/docs/api',
  keywords: ['repoverix api', 'scans api', 'sarif export', 'bearer token'],
});

const GROUPS = [
  {
    name: 'Auth',
    prefix: '/api/v1/auth',
    rows: [
      ['POST /signup', 'Password account. Returns a token plus an email_verified flag.'],
      ['POST /login', 'Token for an existing account.'],
      ['GET /me', 'The signed-in account. Every client calls this first.'],
      ['PUT /me', 'Update full name.'],
      ['DELETE /me', 'Delete the account.'],
      ['GET /me/export', 'Everything stored about the account as JSON.'],
      ['POST /verify-email', 'Open a verification token.'],
      ['POST /resend-verification', 'Send a new link. Console mailer also returns it.'],
      ['POST /forgot-password', 'Start a reset.'],
      ['POST /reset-password', 'Complete a reset with uid + token.'],
      ['POST /change-password', 'Rotate the password. Returns a fresh token; older ones stop working.'],
      ['POST /revoke-all-sessions', 'Invalidate every issued token.'],
      ['GET /security-overview', 'Verification state, account state, recent security events.'],
      ['POST /logout', 'Record the sign-out event. Token is stateless, so this is audit only.'],
    ],
  },
  {
    name: 'OAuth',
    prefix: '/api/v1/auth/oauth',
    rows: [
      ['GET /providers', 'Which providers this deployment has keys for.'],
      ['GET /{provider}/login', 'Browser redirect into the consent screen.'],
      ['GET /{provider}/callback', 'Provider return URL; hands the session back to the app.'],
      ['GET /connections', 'Connected providers for the current account.'],
      ['GET /{provider}/repos', 'Repositories the granted token can read.'],
      ['DELETE /{provider}', 'Disconnect and forget the stored token.'],
    ],
  },
  {
    name: 'Repositories',
    prefix: '/api/v1/repositories',
    rows: [
      ['GET /', 'All repositories for the account.'],
      ['POST /', 'Register from a Git URL (github, gitlab, git).'],
      ['POST /zip', 'Multipart upload: name and file. Content is sniffed for ZIP magic.'],
      ['POST /archive', 'Register from a direct ZIP URL.'],
      ['POST /oauth', 'Register from a connected provider: provider and repo_path.'],
      ['GET /{id}', 'One repository.'],
      ['DELETE /{id}', 'Remove the repository and its stored snapshot.'],
      ['GET /{id}/intelligence', 'Health, git insights, wiki and architecture in one payload.'],
      ['GET /{id}/attack-paths', 'Source-to-sink paths found across the snapshot.'],
      ['GET /{id}/dependency-reachability', 'Dependencies with reachability and triage state.'],
      ['GET /{id}/evidence-graph', 'The evidence graph for the latest scan.'],
      ['GET /{id}/regression', 'New, resolved, unchanged and reintroduced findings against a previous scan.'],
      ['POST /{id}/change-audit', 'Blast radius, tests to run and risk score for a diff, ref range or commit.'],
    ],
  },
  {
    name: 'Scans',
    prefix: '/api/v1/scans',
    rows: [
      ['POST /', 'Create a scan. Optional Idempotency-Key header. Runs in the background.'],
      ['GET /', 'Scan history. Optional repository_id filter.'],
      ['GET /{id}', 'Scan with every analysis run and its stage status.'],
      ['GET /{id}/findings', 'Findings for one scan.'],
      ['GET /{id}/report', 'Markdown or JSON report.'],
      ['GET /{id}/sarif', 'SARIF 2.1.0 for code scanning pipelines.'],
      ['GET /{id}/dedup', 'Near-duplicate clusters inside a scan.'],
      ['POST /{id}/cancel', 'Cancel a pending or running scan.'],
    ],
  },
  {
    name: 'Findings',
    prefix: '/api/v1/findings',
    rows: [
      ['GET /', 'List with scan_id, repository_id, category, severity, status, limit, offset.'],
      ['GET /{id}', 'One finding with its evidence chain and candidate patches.'],
      ['GET /{id}/impact', 'Plain-language impact: why it matters, worst case, callers, fix direction.'],
      ['GET /{id}/proof-of-fix', 'The recorded proof: decision, checks, runs and the patch set.'],
      ['POST /{id}/generate-fix', 'Produce a candidate patch. Needs a plan with reasoning.'],
      ['POST /{id}/generate-test', 'Produce a regression test for the finding.'],
      ['POST /generated-tests/{test_id}/run', 'Run a generated test, optionally against a patch.'],
      ['POST /{id}/validate', 'Re-check the claim against the static evidence and update confidence.'],
      ['POST /{id}/validate-counterexample', 'Look for a sanitiser or guard that refutes the chain.'],
      ['POST /{id}/chat', 'Ask about this finding, grounded in its evidence.'],
      ['GET /scan/{scan_id}/summary', 'Counts by category, severity and status for a scan.'],
      ['POST /{id}/feedback', 'Record an analyst verdict: correct, incorrect, already_fixed, not_useful.'],
    ],
  },
  {
    name: 'Patches and verification',
    prefix: '/api/v1/patches',
    rows: [
      ['GET /', 'Patches, filterable by finding_id, scan_id or status.'],
      ['GET /{id}', 'One patch with its diff.'],
      ['GET /{id}/quality', 'Patch quality signals.'],
      ['POST /{id}/verify', 'Run verification in the sandbox.'],
      ['GET /{id}/verifications', 'Every verification run for the patch.'],
      ['GET /verification/{id}', 'One run with its individual test results.'],
    ],
  },
  {
    name: 'Billing, teams, account ops',
    prefix: '/api/v1',
    rows: [
      ['GET /billing', 'Plan entitlements, usage for the period, subscription state.'],
      ['POST /billing/checkout?plan=', 'Checkout session. `demo` is true when no provider keys exist.'],
      ['POST /billing/portal', 'Customer portal session.'],
      ['GET /dashboard/summary', 'Repository, scan and finding totals for the overview.'],
      ['GET /organizations', 'Organizations the account belongs to.'],
      ['POST /organizations', 'Create one.'],
      ['GET /organizations/{id}/members', 'Members and roles.'],
      ['GET /organizations/{id}/dashboard', 'Team rollup: repositories, scans, findings, fix pipeline.'],
      ['GET /organizations/{id}/security-center', 'Posture score, coverage and detection quality.'],
      ['POST /tokens', 'Create a personal API token (returned once).'],
      ['GET /onboarding/status', 'First-run step completion.'],
      ['POST /scans/{id}/share', 'Create a read-only report link with an expiry.'],
    ],
  },
] as const;

export default function ApiReferencePage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          API reference
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          The REST API behind this interface. It is stable, bearer-authenticated, and documented in the
          shape the product actually calls it: endpoint groups first, then the gates and exports that need
          explaining.
        </p>
      </header>

      <Prose className="mt-10">
        <h2>Authentication</h2>
        <p>
          Every authenticated request carries a bearer token obtained from <code>/auth/login</code>,{' '}
          <code>/auth/signup</code> or an OAuth callback.
        </p>
        <CodeBlock label="request shape">{`curl https://your-host/api/v1/findings?severity=critical \\
  -H "Authorization: Bearer $RVX_TOKEN"`}</CodeBlock>
        <p>
          A rejected token returns <code>401</code> and the client clears it. A password account that has
          not opened its verification link can read, but imports and scans stay closed until it does.
        </p>

        <h2>Conventions</h2>
        <ul>
          <li>
            <strong>Errors</strong> use <code>{'{ "detail": "…" }'}</code>. The string is written for a
            person and the interface shows it verbatim.
          </li>
          <li>
            <strong>Status codes</strong> are semantic: 401 for a bad session, 403 for a role that cannot
            act, 404 for something absent or out of scope, 409 for conflicting state, 422 for rejected
            values, 429 for rate limiting, 5xx for service faults.
          </li>
          <li>
            <strong>Plan gates</strong> answer <code>402</code> with an{' '}
            <code>x-upgrade-reason</code> header naming the limit. The interface turns that into a concrete
            upgrade prompt instead of a generic failure.
          </li>
          <li>
            <strong>Timestamps</strong> are serialized as naive UTC. Clients should treat them as UTC,
            this one does.
          </li>
        </ul>

        <h2>Endpoint groups</h2>
        <p>
          Two hundred lines of prose would be worse than one table per group, so each group below lists
          the routes this frontend calls or the product exposes, with the one thing worth knowing about
          each.
        </p>

        {GROUPS.map((group) => (
          <section key={group.name} className="mt-10">
            <h3 className="text-[16px] font-semibold text-ink">
              {group.name}
              <span className="ml-2 font-mono text-[12px] font-normal text-muted">{group.prefix}</span>
            </h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[640px]">
                <thead>
                  <tr>
                    <th className="w-[46%]">Endpoint</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map(([endpoint, note]) => (
                    <tr key={endpoint}>
                      <td className="align-top">
                        <code>{endpoint}</code>
                      </td>
                      <td className="align-top">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <h2>Exports</h2>
        <p>
          Reports and findings leave the product as SARIF or Markdown, so nothing about a scan has to stay
          inside a web session.
        </p>
        <CodeBlock label="ci-friendly export">{`# SARIF 2.1.0 for a code-scanning pipeline
curl -H "Authorization: Bearer $RVX_TOKEN" \\
  "https://your-host/api/v1/scans/<scan-id>/sarif" -o repoverix.sarif

# Markdown report for a review thread
curl -H "Authorization: Bearer $RVX_TOKEN" \\
  "https://your-host/api/v1/scans/<scan-id>/report?format=markdown"`}</CodeBlock>
        <p>
          A share link (<code>POST /scans/{'{id}'}/share</code>) produces a read-only public URL with an
          expiry, for people who should read one result without an account.
        </p>

        <CalloutNote title="What this API does not do">
          There is no endpoint that guarantees a repository is safe, and none that scores a team. The
          verification endpoints report what was executed; a verdict of <em>verified repair</em> means the
          checks ran and passed, nothing more.
        </CalloutNote>

        <h2>Related</h2>
        <ul>
          <li>
            <Link href="/docs/concepts">Evidence model</Link>, what the finding payload actually contains.
          </li>
          <li>
            <Link href="/docs/getting-started">Getting started</Link>, a working request sequence.
          </li>
          <li>
            <Link href="/docs/faq">FAQ</Link>, language support, sandbox requirements and limits.
          </li>
        </ul>
      </Prose>
    </>
  );
}
