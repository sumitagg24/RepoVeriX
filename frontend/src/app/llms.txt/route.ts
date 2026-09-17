import { VULNERABILITY_CLASSES } from '@/lib/seo/vulnerabilities';
import { DETECTION_RULES } from '@/lib/seo/rules';
import { SAMPLE_REPOS } from '@/lib/seo/repos';
import { BLOG_POSTS } from '@/lib/blog';
import { SITE_URL } from '@/lib/site-url';

export const dynamic = 'force-static';

function page(path: string, title: string, description: string): string {
  return `- [${title}](${SITE_URL}${path}): ${description}`;
}

export function GET(): Response {
  const body = `# RepoVeriX

> Evidence-grounded repository-level code auditing and verified automated repair.
> RepoVeriX analyzes repositories with deterministic AST-based detectors, grounds
> every finding in a source-to-sink evidence chain, validates LLM-proposed findings
> with counterexample checks, and certifies generated patches by executing the
> repository's own tests in an isolated sandbox. The operating principle:
> LLM proposes, repository evidence supports, execution verifies.

This file lists the public documentation a retrieval system may quote. Private
application areas (dashboards, repositories, scans, findings, billing, settings)
are not listed and are disallowed in robots.txt. Nothing here requires an account.

## Core concepts

${page('/docs/concepts', 'Concepts & evidence', 'The evidence-chain model: sources, transformations, sinks, counterexample validation, VERIFIED/PROBABLE/REJECTED statuses.')}

## How verification works

${page('/blog/how-a-fix-gets-verified', 'How a fix gets verified', 'The exact pipeline before any patch is called VERIFIED: sandbox, reproduction test, suite, static checks, detector re-analysis.')}

## Vulnerability classes detected (deterministic, AST-based)

${VULNERABILITY_CLASSES.map((v) => page(`/vulnerabilities/${v.slug}`, `${v.name} (${v.cwe})`, v.description)).join('\n')}

## Detection rules (stable rule IDs, same IDs appear in SARIF exports)

${DETECTION_RULES.map((r) => page(`/detections/${r.slug}`, r.id, r.summary)).join('\n')}

## Sample repositories (deliberately vulnerable fixtures with documented ground truth)

${SAMPLE_REPOS.map((r) => page(`/vulnerable-repos/${r.slug}`, r.name, r.summary)).join('\n')}

## Engineering blog

${BLOG_POSTS.map((p) => page(`/blog/${p.slug}`, p.title, p.description)).join('\n')}

## Practical guides

${page('/docs/account-security', 'Account security', 'Email verification, password policy, temporary lockouts, session revocation, provider-connection separation, webhook contract.')}
${page('/integrations/github', 'GitHub integration', 'OAuth scopes, repository import, PR audit flow, SARIF export to GitHub Code Scanning.')}
${page('/integrations/gitlab', 'GitLab integration', 'OAuth scopes, repository import, CI integration.')}
${page('/docs/getting-started', 'Getting started', 'First scan in minutes; what runs without an LLM key and what the key adds.')}

## Honest scope

- Detection covers Python and JavaScript/TypeScript today; other languages are ingested but detector coverage is partial. We say so rather than imply otherwise.
- A finding is only called VERIFIED when repository evidence and validation support it; when evidence is incomplete the status is PROBABLE, and contradicting evidence produces REJECTED with the counterexample recorded.
- Fixes are certified by executing tests and re-running detectors in a sandbox — never by model confidence.
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
