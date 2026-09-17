import type { Metadata } from 'next';
import { IntegrationPage } from '@/components/marketing/integration-page';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'GitHub integration',
  description:
    'Connect GitHub to RepoVeriX: import repositories, run evidence-grounded audits, auto re-analyze on push, export SARIF to code scanning — tokens encrypted at rest.',
  alternates: { canonical: '/integrations/github' },
  openGraph: {
    title: 'GitHub integration - RepoVeriX',
    description:
      'Evidence-grounded GitHub repository auditing with verified automated repair.',
    url: `${SITE_URL}/integrations/github`,
  },
};

const GITHUB_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'GitHub integration - RepoVeriX',
  description:
    'Connect GitHub to RepoVeriX for evidence-grounded repository auditing, change audits and SARIF export.',
  url: `${SITE_URL}/integrations/github`,
};

export default function GitHubIntegrationPage() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(GITHUB_JSON_LD) }}
      />
      <IntegrationPage
        data={{
          provider: 'GitHub',
          headline: 'Audit GitHub repositories with evidence, not vibes.',
          description:
            'Connect your GitHub account once, import the repositories you choose, and run the full RepoVeriX pipeline: static detectors, LLM reasoning, evidence chains and sandboxed fix verification — with automatic re-analysis on every push.',
          scopes: ['read:user', 'user:email', 'repo'],
          scopesNote:
            'Reading private repository contents over the GitHub API requires the repo scope. RepoVeriX never pushes commits to your repositories: generated patches are applied to isolated copies inside the analysis sandbox, and you decide what happens to any proposed fix.',
          capabilities: [
            {
              title: 'One-click import',
              detail:
                'Browse your importable repositories (public and private) and connect the ones you want — full git history included for hotspots, ownership and co-change analysis.',
            },
            {
              title: 'Evidence-grounded scans',
              detail:
                'Static detectors plus LLM reasoning produce findings with source→sink evidence chains, confidence and computed VERIFIED / PROBABLE / REJECTED statuses.',
            },
            {
              title: 'Change audits for diffs & PRs',
              detail:
                'Point the change-audit API at any diff or pull request for a 0–100 risk score, blast radius over the call graph, missing tests and co-change directives.',
            },
            {
              title: 'Automatic re-analysis',
              detail:
                'Add the provided webhook and every push to your default branch triggers a signature-verified, deduplicated re-scan — findings stay current without manual work.',
            },
            {
              title: 'SARIF 2.1.0 export',
              detail:
                'Download any scan as SARIF and upload it to GitHub code scanning, or open it in tools that understand the standard.',
            },
            {
              title: 'Verified automated repair',
              detail:
                'For verified findings, generate a candidate patch, run it against your test suite and static checks in an isolated sandbox, and get a deterministic verdict.',
            },
          ],
          securityPoints: [
            'Tokens are encrypted at rest and never exposed to the browser.',
            'The OAuth flow uses a signed state cookie (CSRF protection) and server-side token exchange.',
            'Disconnect instantly from Settings → Connected accounts; the stored token is deleted.',
            'Repository code is analyzed in isolated environments and never executed on the application server.',
          ],
          setupSteps: [
            'Create a free RepoVeriX account and click "Connect GitHub" — you will be redirected to GitHub to approve the permissions listed above.',
            'Pick repositories from your import list, or paste any public repository URL to try it without connecting.',
            'Optional: add the RepoVeriX webhook (URL and secret are provided per repository) to enable automatic re-analysis on push.',
            'Optional: create an API token in Settings to run change audits from GitHub Actions or any CI.',
          ],
        }}
      />
    </>
  );
}
