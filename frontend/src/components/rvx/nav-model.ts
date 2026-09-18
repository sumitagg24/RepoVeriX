import {
  Activity,
  Boxes,
  Bug,
  CreditCard,
  FlaskConical,
  Gauge,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Globe,
  LayoutPanelTop,
  Plug,
  BookOpen,
  LineChart,
  ScanSearch,
  Share2,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  Users,
  Waypoints,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

/**
 * The console's navigation model, in one place.
 *
 * Two layers:
 *   1. GLOBAL — the daily loop, in the order an investigation actually happens
 *      (see what is exposed → what was found → what is analysing → what is
 *      proposed for review → what was audited externally → who else is here).
 *   2. REPOSITORY — the deep views, which only exist once a repository is in
 *      context. A global link to these would 404 for anyone without one, which
 *      is why they are injected rather than hard-coded into the rail.
 */

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Short form for the icon rail tooltip. */
  short: string;
};

export type NavSection = { section: string; items: NavItem[] };

export const GLOBAL_SECTIONS: NavSection[] = [
  {
    section: 'Surface',
    items: [
      { name: 'Overview', href: '/dashboard', icon: Gauge, short: 'Overview' },
      { name: 'Repositories', href: '/repositories', icon: GitBranch, short: 'Repos' },
      { name: 'Findings', href: '/findings', icon: Bug, short: 'Findings' },
      { name: 'Scans', href: '/scans', icon: ScanSearch, short: 'Scans' },
      { name: 'Rules', href: '/rules', icon: BookOpen, short: 'Rules' },
    ],
  },
  {
    section: 'Review',
    items: [
      { name: 'Pull requests', href: '/pull-requests', icon: GitPullRequest, short: 'PRs' },
      { name: 'Website audits', href: '/websites', icon: Globe, short: 'Sites' },
      { name: 'Integrations', href: '/integrations', icon: Plug, short: 'Integrations' },
    ],
  },
  {
    section: 'Workspace',
    items: [
      { name: 'Team', href: '/team', icon: Users, short: 'Team' },
      { name: 'Billing', href: '/billing', icon: CreditCard, short: 'Billing' },
      { name: 'Settings', href: '/settings', icon: SlidersHorizontal, short: 'Settings' },
    ],
  },
];

/** The four items that live in the icon rail itself; the rest open the panel. */
export const RAIL_ITEMS: NavItem[] = GLOBAL_SECTIONS[0].items;

export type RepoView = NavItem;

export const REPO_VIEWS: RepoView[] = [
  { name: 'Overview', href: '', icon: LayoutPanelTop, short: 'Overview' },
  { name: 'Attack paths', href: '/audit?tab=attack', icon: Waypoints, short: 'Attack paths' },
  { name: 'Architecture', href: '/intelligence?tab=architecture', icon: Boxes, short: 'Architecture' },
  { name: 'Code health', href: '/intelligence?tab=health', icon: Activity, short: 'Code health' },
  { name: 'Git intelligence', href: '/intelligence?tab=git', icon: GitCommitHorizontal, short: 'Git' },
  { name: 'Evidence graph', href: '/graph', icon: Share2, short: 'Evidence graph' },
  { name: 'Health history', href: '/history', icon: LineChart, short: 'History' },
  { name: 'Regression', href: '/regression', icon: TrendingDown, short: 'Regression' },
  { name: 'Research', href: '/research', icon: FlaskConical, short: 'Research' },
  { name: 'Ask RepoVeriX', href: '/intelligence?tab=ask', icon: Sparkles, short: 'Ask' },
];

export const MOBILE_ITEMS: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: Gauge, short: 'Overview' },
  { name: 'Repositories', href: '/repositories', icon: GitBranch, short: 'Repos' },
  { name: 'Findings', href: '/findings', icon: Bug, short: 'Findings' },
  { name: 'Scans', href: '/scans', icon: ScanSearch, short: 'Scans' },
];

export function repoViewHref(repoId: string, view: RepoView): string {
  return `/repositories/${repoId}${view.href}`;
}

/** True when `href` addresses the current location (or a descendant of it). */
export function isActivePath(pathname: string, href: string, exact = false): boolean {
  const clean = href.split('?')[0];
  if (exact) return pathname === clean;
  return pathname === clean || pathname.startsWith(`${clean}/`);
}

/** The repository id when the current path is repository-scoped. */
export function activeRepoIdFromPath(pathname: string): string | null {
  return pathname.match(/^\/repositories\/([0-9a-f-]{8,})/)?.[1] ?? null;
}
