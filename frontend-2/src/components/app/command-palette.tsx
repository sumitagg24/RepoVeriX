'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowRight, CornerDownLeft, Database, Search } from 'lucide-react';

import { NAV_ITEMS, PALETTE_ACTIONS } from '@/components/app/nav-model';
import { useRepositories } from '@/hooks/use-repositories';
import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  label: string;
  hint: string;
  group: 'Actions' | 'Pages' | 'Repositories';
  href: string;
  icon?: React.ReactNode;
}

/**
 * Command palette.
 *
 * Searches the three things a person actually wants mid-task: an action, a page,
 * and a repository (by name, straight from the loaded list). Keyboard driven:
 * arrows move, enter opens, escape closes, and the first match is preselected so
 * a two-keystroke flow stays two keystrokes.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const repositories = useRepositories();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPaletteKey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isPaletteKey) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const entries = React.useMemo<Entry[]>(() => {
    const pages: Entry[] = NAV_ITEMS.map((item) => ({
      id: `page:${item.href}`,
      label: item.label,
      hint: item.description,
      group: 'Pages',
      href: item.href,
    }));
    const actions: Entry[] = PALETTE_ACTIONS.map((action) => ({
      id: `action:${action.href}:${action.label}`,
      label: action.label,
      hint: action.description,
      group: 'Actions',
      href: action.href,
    }));
    const repos: Entry[] = (repositories.data ?? []).map((repo) => ({
      id: `repo:${repo.id}`,
      label: repo.name,
      hint: `${repo.source_type} · ${repo.status}`,
      group: 'Repositories',
      href: `/repositories/${repo.id}`,
      icon: <Database className="size-3.5" aria-hidden="true" />,
    }));
    return [...pages, ...repos, ...actions];
  }, [repositories.data]);

  const results = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return entries.filter((entry) => entry.group !== 'Repositories').slice(0, 9).concat(
        entries.filter((entry) => entry.group === 'Repositories').slice(0, 4),
      );
    }
    return entries
      .filter((entry) => `${entry.label} ${entry.hint}`.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [entries, query]);

  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  const go = React.useCallback(
    (entry: Entry | undefined) => {
      if (!entry) return;
      onOpenChange(false);
      router.push(entry.href);
    },
    [onOpenChange, router],
  );

  const grouped = React.useMemo(() => {
    const map = new Map<Entry['group'], Entry[]>();
    results.forEach((entry) => {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    });
    return Array.from(map.entries());
  }, [results]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-950/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-hairline bg-card shadow-overlay data-[state=open]:animate-scale-in"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              go(results[activeIndex]);
            }
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search for a page, a repository or an action.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2.5 border-b border-hairline px-4">
            <Search className="size-4 shrink-0 text-faint" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search pages, repositories and actions"
              aria-label="Search pages, repositories and actions"
              className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
            />
            <kbd className="kbd">Esc</kbd>
          </div>

          <div className="max-h-[52vh] overflow-y-auto p-2">
            {grouped.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted">
                Nothing matches “{query}”. Try a repository name or a page such as Findings.
              </p>
            ) : (
              grouped.map(([group, items]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <p className="px-2.5 py-1.5 text-[11.5px] font-medium text-faint">{group}</p>
                  <ul>
                    {items.map((entry) => {
                      const index = results.indexOf(entry);
                      const active = index === activeIndex;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => go(entry)}
                            className={cn(
                              'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors',
                              active ? 'bg-surface' : 'hover:bg-surface/70',
                            )}
                          >
                            {entry.icon ? (
                              <span className="text-faint">{entry.icon}</span>
                            ) : (
                              <ArrowRight className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] text-ink">{entry.label}</span>
                              <span className="block truncate text-[12px] text-muted">{entry.hint}</span>
                            </span>
                            {active ? (
                              <CornerDownLeft className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
