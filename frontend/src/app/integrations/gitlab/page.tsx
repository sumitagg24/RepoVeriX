import type { Metadata } from 'next';
import { IntegrationPage } from '@/components/marketing/integration-page';
import { SITE_URL } from '@/lib/site-url';

export const metadata: Metadata = {
  title: 'GitLab integration',
  description:
    'Connect GitLab to RepoVeriX: import repositories, run evidence-grounded audits, auto re-analyze on push, export SARIF — read-only scopes, tokens encrypted at rest.',
  alternates: { canonical: '/integrations/gitlab' },
  openGraph: {
    title: 'GitLab integration - RepoVeriX',
    description:
      'Evidence-grounded GitLab repository auditing with verified automated repair.',
    url: `${SITE_URL}/integrations/gitlab`,
  },
};

const GITLAB_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'GitLab integration - RepoVeriX',
  description:
    'Connect GitLab to RepoVeriX for evidence-grounded repository auditing, change audits and SARIF export.',
  url: `${SITE_URL}/integrations/gitlab`,
};

export default function GitLabIntegrationPage() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(GITLAB_JSON_LD) }}
      />
      <IntegrationPage
        data={{
          provider: 'GitLab',
          headline: 'Audit GitLab repositories with evidence, not vibes.',
          description:
            'Connect your GitLab account once, import the projects you choose, and run the full RepoVeriX pipeline: static detectors, LLM reasoning, evidence chains and sandboxed fix verification — with automatic re-analysis on every push. Works with GitLab.com and self-managed instances.',
          scopes: ['read_user', 'read_api', 'read_repository'],
          scopesNote:
            'RepoVeriX requests read-only GitLab scopes: your profile, API read access and repository read access. Nothing you write to GitLab is ever touched — generated patches are applied to isolated copies inside the analysis sandbox.',
          capabilities: [
            {
              title: 'One-click import',
              detail:
                'Browse your importable projects and connect the ones you want — full git history included for hotspots, ownership and co-change analysis.',
            },
            {
              title: 'Evidence-grounded scans',
              detail:
                'Static detectors plus LLM reasoning produce findings with source→sink evidence chains, confidence and computed VERIFIED / PROBABLE / REJECTED statuses.',
            },
            {
              title: 'Change audits for diffs & MRs',
              detail:
                'Point the change-audit API at any diff for a 0–100 risk score, blast radius over the call graph, missing tests and co-change directives.',
            },
            {
              title: 'Automatic re-analysis',
              detail:
                'Add the provided webhook (push events) and every push to your default branch triggers a token-verified, deduplicated re-scan.',
            },
            {
              title: 'CI-friendly API tokens',
              detail:
                'Create a scoped token in Settings and run change audits straight from .gitlab-ci.yml — gate merges on deterministic risk evidence.',
            },
            {
              title: 'SARIF 2.1.0 export',
              detail:
                'Download any scan as SARIF for code-scanning tools, security dashboards or your IDE.',
            },
          ],
          securityPoints: [
            'Tokens are encrypted at rest and never exposed to the browser.',
            'The OAuth flow uses a signed state cookie (CSRF protection) and server-side token exchange.',
            'Disconnect instantly from Settings → Connected accounts; the stored token is deleted.',
            'Repository code is analyzed in isolated environments and never executed on the application server.',
          ],
          setupSteps: [
            'Create a free RepoVeriX account and click "Connect GitLab" — you will be redirected to GitLab to approve the read-only scopes listed above.',
            'Pick projects from your import list, or paste any public repository URL to try it without connecting.',
            'Optional: add the RepoVeriX webhook (URL and secret are provided per project) to enable automatic re-analysis on push.',
            'Optional: create an API token in Settings and call the change-audit endpoint from your .gitlab-ci.yml pipeline.',
          ],
        }}
      />
    </>
  );
}
