import {
  BookOpen,
  CreditCard,
  Database,
  FileSearch,
  LifeBuoy,
  Plug,
  ScanSearch,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Human sentence used by the command palette and empty states. */
  description: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Navigation.
 *
 * Two groups, in the order the work happens: find risk, then configure the
 * workspace. Anything that does not have a page backed by real data is not here.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'risk',
    label: 'Risk',
    items: [
      {
        href: '/dashboard',
        label: 'Overview',
        icon: ShieldCheck,
        description: 'Posture, what needs a decision, and what changed',
      },
      {
        href: '/repositories',
        label: 'Repositories',
        icon: Database,
        description: 'Connected repositories, scope and scan history',
      },
      {
        href: '/scans',
        label: 'Scans',
        icon: ScanSearch,
        description: 'Every scan, its configuration and its outcome',
      },
      {
        href: '/findings',
        label: 'Findings',
        icon: FileSearch,
        description: 'Findings with severity, verdict and file context',
      },
      {
        href: '/rules',
        label: 'Rules',
        icon: BookOpen,
        description: 'Detection rules and what each one looks for',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      {
        href: '/settings/integrations',
        label: 'Integrations',
        icon: Plug,
        description: 'Source control connections and their state',
      },
      {
        href: '/billing',
        label: 'Billing',
        icon: CreditCard,
        description: 'Plan, entitlement limits and current usage',
      },
      {
        href: '/settings',
        label: 'Settings',
        icon: Settings,
        description: 'Profile, security and notification preferences',
      },
      {
        href: '/settings/team',
        label: 'Team',
        icon: Users,
        description: 'Organizations, members and repository attachments',
      },
      {
        href: '/help',
        label: 'Help',
        icon: LifeBuoy,
        description: 'Documentation entry point and keyboard shortcuts',
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Actions the palette can run without navigating first. */
export const PALETTE_ACTIONS = [
  { href: '/scans/new', label: 'Start a scan', description: 'Pick a repository and configuration' },
  { href: '/repositories/new', label: 'Import a repository', description: 'Git URL, archive URL or ZIP upload' },
  { href: '/settings/integrations', label: 'Connect a provider', description: 'GitHub, GitLab or a direct Git URL' },
  { href: '/settings/security', label: 'Review account security', description: 'Password, sessions and verification' },
  { href: '/billing', label: 'Review plan usage', description: 'Limits, period end and upgrades' },
] as const;
