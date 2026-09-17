import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { H1, P, Callout, DocLink } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about scan quotas, finding confidence, language support, data safety and plan limits.',
  alternates: { canonical: '/docs/faq' },
};

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: 'How is RepoVeriX different from a code scanner?',
    a: (
      <>
        Scanners emit findings; RepoVeriX grounds them. Each finding carries an evidence chain
        (source → transformation → sink), a counterexample check, and a confidence derived from
        evidence — then repairs are certified by actually running your tests in a sandbox. See{' '}
        <DocLink href="/docs/concepts">Concepts &amp; evidence</DocLink>.
      </>
    ),
  },
  {
    q: 'Does it need an LLM API key to work?',
    a: (
      <>
        No. Deterministic layers — static analysis, code health, git intelligence, attack paths,
        evidence validation — run without any LLM. LLM reasoning, wiki prose and LLM-generated
        tests activate when you configure a provider (<DocLink href="/docs/configuration">keys</DocLink>).
      </>
    ),
  },
  {
    q: 'Which platforms can I import from?',
    a: (
      <>
        GitHub and GitLab (OAuth connect or a plain URL), any git host, a direct archive URL
        (including S3 presigned links), or a ZIP upload. Archives are screened for traversal,
        symlink and zip-bomb attacks.
      </>
    ),
  },
  {
    q: 'What languages are supported?',
    a: (
      <>
        Python, JavaScript and TypeScript get the full treatment: tree-sitter parsing, symbols,
        call graph, attack paths and AST-grounded validation. Other languages are still ingested
        and can be scanned by static detectors that support them.
      </>
    ),
  },
  {
    q: 'Which checks run without Docker?',
    a: (
      <>
        Everything except execution-backed steps. Patch verification and reproduction-test runs
        execute code, so they need the Docker sandbox (or the explicit local fallback, which is
        only safe for trusted development fixtures).
      </>
    ),
  },
  {
    q: 'Are patches ever applied to my code automatically?',
    a: 'Never. Patches are generated as reviewable diffs and only applied inside an isolated verification copy where tests and static checks run first.',
  },
  {
    q: 'How do I audit a pull request?',
    a: (
      <>
        Connect a GitHub account with OAuth, open the Pull Requests page, pick the PR, and run an
        analysis. You get a structured review you can preview before deciding to post comments.
        See the <DocLink href="/docs/features#change">feature guide</DocLink>.
      </>
    ),
  },
  {
    q: 'Can I compare two scans or track health over time?',
    a: (
      <>
        Yes — the Regression page compares scans by stable fingerprints (resolved / new / still
        present / regressed / severity changed), and the Health History page charts recorded health
        snapshots over time.
      </>
    ),
  },
  {
    q: 'What is in the free plan?',
    a: (
      <>
        The free plan includes a small number of repositories and scans per month with static and
        hybrid findings plus a couple of sandbox verifications — enough to audit a small
        repository end-to-end. Plan limits are enforced server-side on the account.
      </>
    ),
  },
  {
    q: 'Can I run it myself?',
    a: (
      <>
        Yes — RepoVeriX is self-hostable with Docker Compose. Start with the{' '}
        <DocLink href="/docs/getting-started">Quick start</DocLink>, then the{' '}
        <DocLink href="/docs/configuration">production checklist</DocLink>.
      </>
    ),
  },
  {
    q: 'How do I export results?',
    a: (
      <>
        Each scan exports a full audit report (JSON or Markdown) and a SARIF 2.1.0 file you can
        feed into code-scanning tooling. REJECTED findings are excluded from SARIF results.
      </>
    ),
  },
  {
    q: 'Where can I ask for help?',
    a: (
      <>
        Use the in-app Ask assistant on any repository for grounded answers, open the settings
        page for account/billing help, or ask us via the links in the site footer.
      </>
    ),
  },
];

export default function DocsFaqPage() {
  return (
    <>
      <H1>FAQ</H1>
      <P lead>Short answers to the questions that come up most.</P>
      <div className="mt-6 space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="group rounded-2xl border bg-card px-6 py-4 shadow-sm open:shadow-md">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {f.q}
              <span className="text-muted-foreground transition-transform duration-300 group-open:rotate-45">+</span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</div>
          </details>
        ))}
      </div>

      <Callout kind="info">
        Still stuck? Try the <DocLink href="/docs/getting-started">Quick start</DocLink> first —
        most questions are &quot;where do I find X&quot; and the answer is one click away in the
        feature guide.
      </Callout>
    </>
  );
}
