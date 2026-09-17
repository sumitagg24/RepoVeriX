import type { LucideIcon } from 'lucide-react';
import {
  Blocks,
  CreditCard,
  LifeBuoy,
  Plug,
  Rocket,
  Shield,
} from 'lucide-react';

export interface HelpArticle {
  title: string;
  href: string;
  /** One-line description shown in cards and search results. */
  blurb: string;
}

/** Search result: a help article annotated with its category. */
export interface HelpSearchResult extends HelpArticle {
  category: string;
}

export interface HelpCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  href: string;
  articles: HelpArticle[];
}

/** Real content destinations — every href exists in this app. */
export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'get-started',
    label: 'Get started',
    icon: Rocket,
    description: 'Import your first repository and read your first audit.',
    href: '/help/get-started',
    articles: [
      { title: 'Quick start', href: '/docs/getting-started', blurb: 'Import a repository, run a scan and inspect evidence in five minutes.' },
      { title: 'Import a repository', href: '/docs/getting-started#hosted', blurb: 'Connect GitHub or GitLab, paste a URL, or upload a ZIP archive.' },
      { title: 'The audit workflow', href: '/docs/concepts#pipeline', blurb: 'Repository → understand → analyze → validate → fix → verify.' },
      { title: 'Sample repositories', href: '/', blurb: 'Audit a built-in fixture to see findings, evidence and repairs before importing your own code.' },
    ],
  },
  {
    id: 'features',
    label: 'Features and analyses',
    icon: Blocks,
    description: 'Browse every engine and what evidence it uses.',
    href: '/help/features',
    articles: [
      { title: 'All analysis engines', href: '/docs/features', blurb: 'Code health, attack paths, dependency reachability, validation and more.' },
      { title: 'Evidence chains', href: '/docs/concepts#evidence', blurb: 'How findings link source input → transformation → sink with real excerpts.' },
      { title: 'Counterexample validation', href: '/docs/features#security', blurb: 'Why VERIFIED, PROBABLE and REJECTED are decided by evidence, not confidence.' },
      { title: 'Verified repair (Proof of Fix)', href: '/docs/concepts#verdicts', blurb: 'The Proof of Fix workflow — patches only count as fixed after tests and re-analysis pass in the sandbox.' },
      { title: 'Change impact & PR audit', href: '/docs/features#change', blurb: 'What else could break when you change a file, and what a PR touches.' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing and plans',
    icon: CreditCard,
    description: 'Quotas, upgrades and invoices.',
    href: '/help/billing',
    articles: [
      { title: 'Plans and quotas', href: '/#pricing', blurb: 'Free, Pro and Team limits for repositories, scans, AI fixes and verifications.' },
      { title: 'Upgrade or manage plan', href: '/billing', blurb: 'Change plans and review usage from the billing dashboard (signed in).' },
      { title: 'Why was an action blocked?', href: '/docs/faq', blurb: 'Quotas block the action with an upgrade prompt — never a surprise charge.' },
    ],
  },
  {
    id: 'security',
    label: 'Security and privacy',
    icon: Shield,
    description: 'How your code and accounts are protected.',
    href: '/help/security',
    articles: [
      { title: 'Account security', href: '/docs/account-security', blurb: 'Email verification, password reset, temporary lockouts, sessions and provider connections.' },
      { title: 'Security analysis', href: '/docs/features#security', blurb: 'Attack paths, dependency reachability and untrusted-repository handling.' },
      { title: 'Privacy policy', href: '/privacy', blurb: 'What we store, cookies, repository content and deletion.' },
      { title: 'Terms of service', href: '/terms', blurb: 'The service, fair use and liability.' },
      { title: 'Data & secrets', href: '/docs/configuration', blurb: 'Keys live server-side; nothing sensitive reaches the browser or logs.' },
    ],
  },
  {
    id: 'api',
    label: 'Integrations and API',
    icon: Plug,
    description: 'SARIF, CI and OAuth connections.',
    href: '/help/api',
    articles: [
      { title: 'API reference', href: '/docs/api', blurb: 'Every endpoint: repositories, scans, findings, evidence, repairs.' },
      { title: 'SARIF export', href: '/docs/features#health', blurb: 'Feed results into GitHub Code Scanning and VS Code.' },
      { title: 'Connect GitHub / GitLab', href: '/settings', blurb: 'Link accounts to import repositories and audit pull requests.' },
    ],
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting and support',
    icon: LifeBuoy,
    description: 'Common problems and where to get help.',
    href: '/help/troubleshooting',
    articles: [
      { title: 'FAQ', href: '/docs/faq', blurb: 'Answers to the most common questions.' },
      { title: 'Self-hosting', href: '/docs/getting-started#self-host', blurb: 'Run RepoVeriX with Docker Compose and keep everything under your control.' },
      { title: 'Configuration reference', href: '/docs/configuration', blurb: 'Every REPOVERIX_ environment variable and the production checklist.' },
      { title: 'Still stuck?', href: '/contact', blurb: 'Reach the team with your scan details for faster help.' },
    ],
  },
];

/** Curated “most viewed / most useful” list — real destinations. */
export const POPULAR_LIST: HelpArticle[] = [
  { title: 'Quick start', href: '/docs/getting-started', blurb: 'From import to verified repair in five minutes.' },
  { title: 'All analysis engines', href: '/docs/features', blurb: 'What every RepoVeriX engine does and the evidence it uses.' },
  { title: 'Evidence chains', href: '/docs/concepts', blurb: 'How LLM proposes → evidence supports → execution verifies.' },
  { title: 'FAQ', href: '/docs/faq', blurb: 'Common questions, answered.' },
  { title: 'Plans and quotas', href: '/#pricing', blurb: 'Free, Pro and Team — what each includes.' },
  { title: 'Why was an action blocked?', href: '/docs/faq', blurb: 'Quota limits explained.' },
];

export const ALL_HELP_ARTICLES: HelpSearchResult[] = HELP_CATEGORIES.flatMap((c) =>
  c.articles.map((a) => ({ ...a, category: c.label }))
);
