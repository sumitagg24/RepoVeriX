import Link from 'next/link';
import type { Metadata } from 'next';

import { CalloutNote, CodeBlock, Prose } from '@/components/marketing/prose';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Getting started',
  description:
    'Import a repository, run a scan with a configuration you can explain, and read a finding from claim to verification record.',
  path: '/docs/getting-started',
  keywords: ['scan a repository', 'import repository', 'first security scan'],
});

export default function GettingStartedPage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Getting started
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          The order below is deliberate: each step produces the thing the next one needs, and the third
          step is the one that decides whether the output is worth wiring into a process.
        </p>
      </header>

      <Prose className="mt-10">
        <h2>1. Create an account and verify it</h2>
        <p>
          Password accounts start unverified, and the API keeps repository imports and scans closed until
          the verification link is opened. The link is emailed at signup; on a development deployment the
          console mailer prints it instead. OAuth sign-ins arrive verified.
        </p>
        <CodeBlock label="create an account">{`curl -s https://your-host/api/v1/auth/signup \\
  -H 'Content-Type: application/json' \\
  -d '{"email":"you@example.com","password":"...","full_name":"Your Name"}'`}</CodeBlock>
        <p>
          The response carries an access token, an <code>email_verified</code> flag, and on development
          deployments a <code>dev_verification_url</code> for the console mailer.
        </p>

        <h2>2. Import one repository</h2>
        <p>
          Five import paths exist, and they behave the same way once the repository is registered: a
          snapshot is stored, and every scan reads that snapshot. Your working copy is never modified.
        </p>
        <CodeBlock label="register a git repository">{`curl -s https://your-host/api/v1/repositories \\
  -H "Authorization: Bearer $RVX_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"checkout-service","source_type":"git",
       "source_url":"https://github.com/acme/checkout-service.git",
       "default_branch":"main"}'`}</CodeBlock>
        <p>
          An uploaded archive uses <code>POST /api/v1/repositories/zip</code> with a multipart body
          (<code>name</code> and <code>file</code>), and a hosted archive uses{' '}
          <code>POST /api/v1/repositories/archive</code> with the direct ZIP URL. Uploaded content is
          sniffed for ZIP magic bytes, never trusted by extension.
        </p>

        <h2>3. Run a static-only scan first</h2>
        <p>
          Static-only runs the deterministic detectors with no model provider, so it validates the
          deployment and the repository in one pass. It is also the configuration to use when no provider
          keys exist at all.
        </p>
        <CodeBlock label="start a scan">{`curl -s https://your-host/api/v1/scans \\
  -H "Authorization: Bearer $RVX_TOKEN" \\
  -H 'Content-Type: application/json' \\
  -d '{"repository_id":"<uuid>","configuration":"static_only"}'`}</CodeBlock>
        <p>
          Scans run in the background. A client may send an <code>Idempotency-Key</code> header so a
          retried request resolves to the original scan instead of queueing a second one.
        </p>
        <CalloutNote title="Configurations are not tiers">
          Four configurations exist: <code>static_only</code>, <code>llm_only</code>,{' '}
          <code>static_llm</code> and <code>repoverix</code> (the full pipeline with evidence
          validation). Configurations that call a model need a plan with reasoning enabled. Comparing two
          configurations on the same repository is a supported workflow, not a workaround.
        </CalloutNote>

        <h2>4. Read the scan before the findings</h2>
        <p>
          The scan detail page lists every stage with its own status, timing and output. Reading it first
          tells you what the run had to work with: the file count, the languages detected, and whether a
          stage failed or was skipped.
        </p>
        <CodeBlock label="scan detail and its findings">{`curl -s "https://your-host/api/v1/scans/<scan-id>" \\
  -H "Authorization: Bearer $RVX_TOKEN"

curl -s "https://your-host/api/v1/findings?severity=critical&status=verified&limit=50" \\
  -H "Authorization: Bearer $RVX_TOKEN"`}</CodeBlock>

        <h2>5. Read one finding all the way down</h2>
        <p>
          A finding opens with the claim in one sentence, then the evidence chain: where untrusted input
          enters, how it is transformed, and which sink it reaches, each with file and line evidence.
          Confidence and reachability follow, then the code and the rule that fired.
        </p>
        <p>
          The detail response also carries the candidate patches and verification runs that exist for that
          finding, so a single request is enough to render the whole page.
        </p>

        <h2>6. Decide what to do with it</h2>
        <ul>
          <li>
            If the chain is reachable and the verdict is <strong>verified</strong>, it is worth a change.
          </li>
          <li>
            If the verdict is <strong>probable</strong>, the claim is supported but unproven. That is
            usually a request for a check rather than a fix.
          </li>
          <li>
            If the verdict is <strong>rejected</strong>, keep it. A refutation with its checks attached is
            the reason the rest of the list can be trusted.
          </li>
        </ul>

        <h2>Where to go next</h2>
        <ul>
          <li>
            <Link href="/docs/concepts">The evidence model</Link> explains how verdicts are decided.
          </li>
          <li>
            <Link href="/docs/api">The API reference</Link> lists every endpoint, its parameters and its
            plan gates.
          </li>
          <li>
            <Link href="/rules">Detection rules</Link> lists the shipped rule IDs and what each detector
            looks for.
          </li>
        </ul>
      </Prose>
    </>
  );
}
