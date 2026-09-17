import type { Metadata } from 'next';
import { H1, H2, P, Ul, Li, Card, Callout, DocTable } from '@/components/docs/primitives';

export const metadata: Metadata = {
  title: 'Research',
  description: 'RepoVeriX-Bench: the four-configuration experiment harness, metrics (precision, recall, F1) and reproducibility standards.',
  alternates: { canonical: '/docs/research' },
};

export default function DocsResearchPage() {
  return (
    <>
      <H1>RepoVeriX-Bench</H1>
      <P lead>
        The research claim is not &quot;an LLM finds bugs&quot; — it is that LLM reasoning combined
        with deterministic evidence and automated verification measurably beats either alone.
        RepoVeriX ships the harness to prove it, and every published number comes from a recorded
        run.
      </P>

      <H2 id="configs">The four configurations</H2>
      <DocTable
        head={['Configuration', 'Static analysis', 'LLM', 'Evidence graph & validation']}
        rows={[
          ['A · Static only', '✓', '—', '—'],
          ['B · LLM only', '—', '✓', '—'],
          ['C · Static + LLM', '✓', '✓', '—'],
          ['D · RepoVeriX', '✓', '✓', '✓'],
        ].map((r) => [
          <span key="a" className="font-medium text-foreground">{r[0]}</span>,
          r[1] === '✓' ? '✓' : '—',
          r[2] === '✓' ? '✓' : '—',
          r[3] === '✓' ? '✓' : '—',
        ])}
      />
      <P>
        Configuration D is the full pipeline: static analysis plus repository context plus LLM
        reasoning, then every candidate goes through the evidence engine, counterexample
        validation, and — for repairs — sandboxed verification.
      </P>

      <H2 id="dataset">Benchmark dataset</H2>
      <P>
        The dataset contains small repositories with a known defect, ground truth, affected files,
        expected behavior and a test that demonstrates the defect — organized by language (Python,
        JavaScript) and defect family (injection, command execution, secrets, weak crypto, logic
        bugs, deserialization).
      </P>
      <Ul>
        <Li>Every repository is self-contained and safe to execute in the sandbox.</Li>
        <Li>Ground truth is defined before any run — never reverse-engineered from outputs.</Li>
        <Li>Defect families are balanced so a scanner that only reports one category cannot inflate its score.</Li>
      </Ul>

      <H2 id="metrics">Metrics</H2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Card title="Detection quality">
          Precision (TP / (TP + FP)), Recall (TP / (TP + FN)), F1 (harmonic mean), and False
          Positive Rate — computed from recorded validation verdicts, where REJECTED candidates
          count as avoided false positives.
        </Card>
        <Card title="Repair quality">
          Patch correctness (verified fixes / attempts), verification success rate, analysis time,
          LLM token usage and cost — logged per scan and per verification run.
        </Card>
      </div>

      <H2 id="honest">Honesty rules for results</H2>
      <Ul>
        <Li>No fabricated numbers — tables stay empty until an experiment actually runs.</Li>
        <Li>Every published figure ships with its conditions: repository set, model, prompt version, sample size.</Li>
        <Li>Validation verdicts are evidence-derived and logged (candidates → verified → probable → rejected), so false-positive reduction is measurable.</Li>
      </Ul>

      <H2 id="research-ui">Research surfaces in the product</H2>
      <P>
        Inside the app, a repository&apos;s Research view exposes the deterministic research
        engines that feed the benchmark:
      </P>
      <Ul>
        <Li><span className="font-medium text-foreground">Multi-agent analysis</span> — five specialized analysts score the same evidence and correlate converging signals.</Li>
        <Li><span className="font-medium text-foreground">Self-improvement</span> — rule/prompt selection experiments.</Li>
        <Li><span className="font-medium text-foreground">Vulnerability mining</span> — historical vulnerability pattern mining over git history.</Li>
        <Li><span className="font-medium text-foreground">Risk model</span> — predictive defect-risk modeling.</Li>
      </Ul>

      <Callout kind="tip">
        Want the honest depth? Read the audit: validation counts, dedup clusters and proof-of-fix
        records are all inspectable in the UI per finding — the same evidence the experiments
        consume.
      </Callout>
    </>
  );
}
