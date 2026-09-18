import Link from 'next/link';
import type { Metadata } from 'next';

import { Prose } from '@/components/marketing/prose';
import { pageMetadata } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Documentation',
  description:
    'RepoVeriX documentation: importing repositories, scan configurations, the evidence model, verdicts and the API this interface calls.',
  path: '/docs',
  keywords: ['repoverix documentation', 'scan configuration', 'evidence model'],
});

const SECTIONS = [
  {
    href: '/docs/getting-started',
    title: 'Getting started',
    body: 'Create an account, import a repository, choose a configuration and read a finding end to end.',
  },
  {
    href: '/docs/concepts',
    title: 'Evidence model',
    body: 'What an evidence chain contains, how severity differs from confidence, and what determines a verdict.',
  },
  {
    href: '/docs/api',
    title: 'API reference',
    body: 'Authentication, endpoint groups, query parameters, plan gates, rate limits and exports.',
  },
  {
    href: '/docs/faq',
    title: 'FAQ',
    body: 'The questions that come up most, answered from how the product behaves rather than from marketing copy.',
  },
] as const;

export default function DocsIndexPage() {
  return (
    <>
      <header className="border-b border-hairline pb-8">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-ink sm:text-[36px]">
          Documentation
        </h1>
        <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-body">
          Four sections cover the product: how to get a first result, what a finding actually contains,
          which endpoints the interface calls, and the questions that come up before adoption.
        </p>
      </header>

      <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href} className="border-t border-hairline pt-5">
            <Link
              href={section.href}
              className="text-[17px] font-semibold text-ink transition-colors hover:text-accent"
            >
              {section.title}
            </Link>
            <p className="mt-2 text-[13.5px] leading-relaxed text-body">{section.body}</p>
          </li>
        ))}
      </ul>

      <Prose className="mt-14">
        <h2>If you only read one page</h2>
        <p>
          Read <Link href="/docs/concepts">the evidence model</Link>. It explains the difference between
          what a scanner reports and what a reviewed finding contains, which is the assumption everything
          else in the product depends on.
        </p>
        <h2>Product limits worth knowing up front</h2>
        <ul>
          <li>Python, JavaScript and TypeScript are the languages parsed today.</li>
          <li>Verification needs container support on the deployment and a plan that includes it.</li>
          <li>There is no CI or pull-request integration yet, and none is implied anywhere in the product.</li>
          <li>An empty scan lists no findings. It does not claim the repository is free of risk.</li>
        </ul>
      </Prose>
    </>
  );
}
