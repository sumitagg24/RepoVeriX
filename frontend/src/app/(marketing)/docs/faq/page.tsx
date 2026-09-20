import Link from 'next/link';
import type { Metadata } from 'next';

import { Prose } from '@/components/marketing/prose';
import { FaqList, type FaqEntry } from '@/components/marketing/sections';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'FAQ',
  description:
    'Answers on detection coverage, verification requirements, empty scans, data handling, plans and what RepoVeriX deliberately does not claim.',
  path: '/docs/faq',
  keywords: ['security scanner faq', 'false positives', 'verification requirements'],
});

const ENTRIES: FaqEntry[] = [
  {
    question: 'What counts as a finding?',
    answer:
      'A reachable path from something a caller controls to a sink that does something risky, with the evidence for each hop recorded. A pattern that matches but has no path behind it is not reported as a finding; it may show up as a lower-confidence note instead.',
  },
  {
    question: 'Which languages are parsed?',
    answer:
      'Python, JavaScript and TypeScript today. Other files in a repository are still stored, and dependency manifests are still read, but call and data-flow analysis only runs on those three.',
  },
  {
    question: 'What does an empty scan mean?',
    answer:
      'That the detectors produced no chains for the configurations that ran. It does not mean the repository is free of risk, and no screen in the product says so. Reading the scan detail first, file count, languages detected, stages that were skipped, tells you how much the run had to work with.',
  },
  {
    question: 'Why do some findings say probable instead of verified?',
    answer:
      'The evidence supports the claim, but no decisive check executed. Usual causes: the deployment has no container sandbox, a dependency could not be installed, or reproducing the path needs input the harness cannot produce. The finding keeps the reasoning and stays upgradeable once verification is available.',
  },
  {
    question: 'What is required to run verification?',
    answer:
      'Container support on the deployment and a plan that includes the sandbox. Verification applies a candidate patch inside an isolated container, installs dependencies, runs the relevant tests, and re-checks the finding against the patched tree. Each run records the checks it performed, including the ones that could not complete.',
  },
  {
    question: 'Are rejected findings removed?',
    answer:
      'No, and that is deliberate. A finding refuted by a reachability check or a sanitiser stays visible with the refutation attached, so the record explains why nothing was done and the count of live risks keeps its meaning.',
  },
  {
    question: 'Does RepoVeriX change my repository?',
    answer:
      'No. A scan reads a stored snapshot. Candidate patches are generated as diffs you can read, and verification applies them inside a throwaway sandbox, never to your working copy or your default branch.',
  },
  {
    question: 'Is there a CI integration or a pull-request check?',
    answer:
      'Not as a shipped integration, and the product does not imply one. What exists is export-shaped: SARIF 2.1.0 and Markdown reports, plus a personal API token. Pull-request analysis endpoints exist for repositories connected through a provider, and they are reachable through the API today.',
  },
  {
    question: 'How is a model provider involved?',
    answer:
      'Only in the configurations that ask for it. static_only runs deterministic detectors and needs no provider at all; llm_only and the hybrid configurations call a provider for reasoning and patch generation, and are limited by plan. A finding from a model-assisted run is labelled with its source so a reader knows which parts were derived and which were parsed.',
  },
  {
    question: 'What happens to my code?',
    answer:
      'A snapshot is stored so scans are reproducible, and it is used only to answer questions about that repository. Uploaded archives are validated by content, not filename. Account data can be exported as JSON and deleted from settings; deleting a repository removes its snapshot.',
  },
  {
    question: 'Can I try it without a payment provider?',
    answer:
      'Yes. Deployments without billing keys report demo mode, and activating a plan locally is one request. The interface shows that mode explicitly rather than pretending a checkout took place.',
  },
  {
    question: 'Do you publish benchmark numbers or accuracy claims?',
    answer:
      'No. Detection quality is reported for your own workspace from the feedback you record, how many findings analysts judged correct, incorrect, already fixed, or not useful, instead of an aggregate number you cannot inspect.',
  },
];

export default function FaqPage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Frequently asked questions
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          The questions that decide whether a team adopts this, answered from how the product behaves
          rather than from a positioning document.
        </p>
      </header>

      <div className="mt-8">
        <FaqList entries={ENTRIES} />
      </div>

      <Prose className="mt-12">
        <h2>Still unresolved?</h2>
        <p>
          The <Link href="/docs/getting-started">getting started guide</Link> covers the first scan
          mechanically, and <Link href="/docs/concepts">the evidence model</Link> explains how a verdict is
          reached. If a question is genuinely about the API, it is usually answered in{' '}
          <Link href="/docs/api">the reference</Link>.
        </p>
      </Prose>
    </>
  );
}
