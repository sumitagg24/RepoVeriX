import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  Command,
  FileCode2,
  Keyboard,
  LifeBuoy,
  Search,
  ShieldCheck,
} from 'lucide-react';

import { AppPage } from '@/components/app/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Kbd } from '@/components/ui/misc';

/**
 * Help.
 *
 * The workspace entry point into the same documentation the public site serves,
 * plus the keyboard map, which is the one thing that is easier to state here
 * than in a doc page because it depends on the shell.
 */
const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open the command palette', alternate: 'Ctrl K on Windows and Linux' },
  { keys: ['/'], label: 'Focus search on a list page', alternate: 'Works on findings, scans and repositories' },
  { keys: ['Esc'], label: 'Close the palette, a dialog or a drawer' },
  { keys: ['Enter'], label: 'Open the highlighted result', alternate: 'Arrow keys move through results' },
] as const;

const GUIDES = [
  {
    title: 'Getting started',
    body: 'Connect a source, import a repository and read the first finding.',
    href: '/docs/getting-started',
    icon: BookOpen,
  },
  {
    title: 'Evidence model',
    body: 'What a chain step is, how severity and confidence differ, and what a verdict means.',
    href: '/docs/concepts',
    icon: FileCode2,
  },
  {
    title: 'API reference',
    body: 'Every endpoint this frontend calls, with the payloads and the error shapes.',
    href: '/docs/api',
    icon: Search,
  },
  {
    title: 'FAQ',
    body: 'Language support, sandbox requirements, exports and what scan counts include.',
    href: '/docs/faq',
    icon: LifeBuoy,
  },
] as const;

export default function HelpPage() {
  return (
    <AppPage>
      <PageHeader
        title="Help"
        description="Documentation for the parts of the product that need explaining, and the keyboard map for the parts that do not."
      />

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <li key={guide.href}>
              <Panel interactive className="h-full">
                <Link href={guide.href} className="flex h-full flex-col gap-2.5 p-5">
                  <span className="flex items-center justify-between gap-3">
                    <Icon className="size-4 text-accent" aria-hidden="true" />
                    <ArrowUpRight className="size-4 text-faint" aria-hidden="true" />
                  </span>
                  <span className="text-[15px] font-medium text-ink">{guide.title}</span>
                  <span className="text-[13px] leading-relaxed text-body">{guide.body}</span>
                </Link>
              </Panel>
            </li>
          );
        })}
      </ul>

      <Panel>
        <PanelHeader
          title="Keyboard"
          hint="The shell is fully operable without a mouse. These are the shortcuts that are not visible as buttons."
          icon={<Keyboard className="size-4" />}
        />
        <div className="px-5 py-5 sm:px-6">
          <ul className="divide-y divide-hairline border-t border-hairline">
            {SHORTCUTS.map((shortcut) => (
              <li
                key={shortcut.label}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] text-ink">{shortcut.label}</p>
                  {'alternate' in shortcut && shortcut.alternate ? (
                    <p className="mt-0.5 text-[12.5px] text-muted">{shortcut.alternate}</p>
                  ) : null}
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {shortcut.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="What the workspace does not do"
            hint="Worth knowing before you go looking for it."
            icon={<ShieldCheck className="size-4" />}
          />
          <div className="px-5 py-5 sm:px-6">
            <ul className="space-y-2.5 text-[13px] leading-relaxed text-body">
              <li>Nothing is written back to your repository. Imports read, scans read, fixes are diffs.</li>
              <li>Finding verdicts are analysis output. Confidence is the analyzer’s own number.</li>
              <li>Verification runs against a copy of the snapshot, never a working tree.</li>
              <li>Issue tracker and chat integrations are not part of the product today.</li>
            </ul>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Command palette"
            hint="Jump to a page or an action without leaving the keyboard."
            icon={<Command className="size-4" />}
          />
          <div className="px-5 py-5 sm:px-6">
            <p className="max-w-[60ch] text-[13px] leading-relaxed text-body">
              The palette searches every workspace route and the actions that do not have their own
              button, such as starting a scan or importing a repository.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button asChild size="sm" variant="secondary">
                <Link href="/docs">Open the documentation</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/docs/faq">Read the FAQ</Link>
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </AppPage>
  );
}
