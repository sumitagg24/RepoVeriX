import Link from 'next/link';
import type { Metadata } from 'next';

import { CalloutNote, CodeBlock, Prose } from '@/components/marketing/prose';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Evidence model',
  description:
    'How a RepoVeriX finding is built: evidence chains, severity versus confidence, reachability, and the four verdicts a verification run can return.',
  path: '/docs/concepts',
  keywords: ['evidence chain', 'code risk verdict', 'severity vs confidence', 'reachability'],
});

export default function ConceptsPage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Evidence model
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          Everything the product shows is downstream of one assumption: a claim about code is only worth
          acting on if a reader can follow it back to the lines that produced it.
        </p>
      </header>

      <Prose className="mt-10">
        <h2>Why every finding carries a chain</h2>
        <p>
          A scanner that prints <em>&ldquo;potential injection at line 148&rdquo;</em> leaves the reader
          holding a guess. The claim may be right, but nothing in the output says why line 148 matters,
          whether anything can actually reach it, or what would change if it were fixed.
        </p>
        <p>
          A RepoVeriX finding instead carries an ordered chain. Each step is evidence: a file, the line
          range, and the construct that was read.
        </p>
        <CodeBlock label="the shape of a chain">{`source     handleRefund()  services/payments.py:L214   request body read
transform  _currency()    services/payments.py:L118   value formatted into SQL text
sink       db.execute      services/payments.py:L151   query executed
verdict    probable                                confidence 0.71   reachability elevated`}</CodeBlock>
        <p>
          Three parts are worth reading separately: the origin, because that is where attacker-controlled
          data enters; the transformations, because one of them usually explains why the value is unsafe by
          the time it reaches the sink; and the sink, because that is where the consequence lands.
        </p>

        <h2>Severity is not confidence</h2>
        <p>
          Two independent judgements sit on every finding, and they answer different questions.
        </p>
        <ul>
          <li>
            <strong>Severity</strong> asks what happens if the claim is true, critical, high, medium or
            low. It is a property of the consequence.
          </li>
          <li>
            <strong>Confidence</strong> asks how strongly the chain supports the claim, from 0 to 1. It is
            a property of the reading.
          </li>
          <li>
            <strong>Reachability</strong> sits beside confidence: is there a path from something an
            attacker or caller controls to the sink?
          </li>
        </ul>
        <p>
          A critical, low-confidence finding and a low-severity, high-confidence finding are different
          pieces of work. Collapsing both into one score hides exactly the distinction a triage decision
          depends on, so the product keeps them separate everywhere they appear.
        </p>

        <CalloutNote title="Read the pair, not the worst case">
          A critical severity with confidence near zero is a note for later. A medium severity with
          confidence near one and elevated reachability is a patch this afternoon.
        </CalloutNote>

        <h2>What the detector knows</h2>
        <p>
          The static detectors parse Python, JavaScript and TypeScript and track data movement inside a
          snapshot of the repository. That gives them call structure, argument positions, imports and
          string construction, enough to establish a chain and to say where it stops.
        </p>
        <p>
          That boundary is a real one, and the product reports it rather than papering over it. Findings
          that depend on configuration, deployment topology or behaviour inside a third-party service are
          marked unproven, because nothing in the source establishes them.
        </p>
        <p>
          Static analysis also cannot prove an absence. An empty scan means the detectors produced no
          chains for the configurations that ran. It does not mean the repository is risk-free, and no
          screen in the product claims otherwise.
        </p>

        <h2>Four verdicts</h2>
        <p>
          A finding starts <strong>unverified</strong>: a supported claim that nothing has tested yet.
          Verification runs checks against a candidate patch and returns one of four outcomes.
        </p>
        <table>
          <thead>
            <tr>
              <th>Verdict</th>
              <th>What the run established</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Verified</strong>
              </td>
              <td>
                The chain reproduces against the current code, and the checks show the risk was eliminated
                while the code still behaves as before.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Probable</strong>
              </td>
              <td>
                The evidence supports the claim, but the run could not execute a decisive check. Common
                causes: the deployment has no sandbox, a dependency is missing, or the path needs external
                input the harness cannot supply.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Rejected</strong>
              </td>
              <td>
                A check ran and refuted the claim, a reachability check failed, or the sink turned out to
                be parameterised. The finding records the refutation instead of quietly disappearing.
              </td>
            </tr>
            <tr>
              <td>
                <strong>Unverified</strong>
              </td>
              <td>No verification has been attempted, or it was attempted in a configuration that cannot verify.</td>
            </tr>
          </tbody>
        </table>

        <h2>Why rejected findings stay visible</h2>
        <p>
          Hiding a refuted finding removes the most useful record the system has: the evidence that
          something was looked at and did not hold. Keeping it explains why nothing was done, prevents the
          same report resurfacing next quarter, and makes the count of live risks mean something.
        </p>
        <p>
          Verdicts are recorded per verification run, and a run can be re-executed later. When a repository
          changes, an earlier verdict does not silently carry over, it becomes stale and is shown that way.
        </p>

        <h2>Where this shows up in the interface</h2>
        <ul>
          <li>
            <Link href="/product">The platform overview</Link> covers how the stages fit together.
          </li>
          <li>
            <Link href="/docs/getting-started">Getting started</Link> walks through a first scan and the
            first finding.
          </li>
          <li>
            <Link href="/docs/faq">The FAQ</Link> answers the practical questions that follow.
          </li>
        </ul>
      </Prose>
    </>
  );
}
