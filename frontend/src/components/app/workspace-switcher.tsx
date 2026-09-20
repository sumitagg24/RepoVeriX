'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Check, ChevronsUpDown, Plus, User } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { useOrganizations } from '@/hooks/use-platform';
import type { OrgRead } from '@/types/api';

const STORAGE_KEY = 'repoverix.workspace';

/**
 * Workspace switcher.
 *
 * Personal scope is a real workspace, not a placeholder: repositories live there
 * until an organization claims them. The selection is kept client-side because
 * the API is already scoped per user, and every organization view is filtered
 * from the server response.
 */
interface WorkspaceContextValue {
  activeId: string;
  activeName: string;
  activeOrg: OrgRead | null;
  organizations: OrgRead[];
  loading: boolean;
  setActiveId: (id: string) => void;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | undefined>(undefined);

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return context;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const organizations = useOrganizations();
  const [activeId, setActiveId] = React.useState('personal');

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setActiveId(stored);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const select = React.useCallback((id: string) => {
    setActiveId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = React.useMemo<WorkspaceContextValue>(() => {
    const list = organizations.data ?? [];
    const org = list.find((item) => item.id === activeId) ?? null;
    return {
      activeId: org ? org.id : 'personal',
      activeName: org ? org.name : 'Personal workspace',
      activeOrg: org,
      organizations: list,
      loading: organizations.isLoading,
      setActiveId: select,
    };
  }, [organizations.data, organizations.isLoading, activeId, select]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function WorkspaceSwitcher() {
  const { activeName, activeOrg, organizations, setActiveId } = useWorkspace();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-56 gap-2">
          {activeOrg ? (
            <Building2 className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          ) : (
            <User className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          )}
          <span className="truncate">{activeName}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64">
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setActiveId('personal')}>
          <User className="size-3.5" aria-hidden="true" />
          <span className="flex-1">Personal workspace</span>
          {!activeOrg ? <Check className="size-3.5 text-accent" aria-hidden="true" /> : null}
        </DropdownMenuItem>

        {organizations.length > 0 ? <DropdownMenuSeparator /> : null}
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} onSelect={() => setActiveId(org.id)}>
            <Building2 className="size-3.5" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{org.name}</span>
              <span className="block truncate text-[11.5px] text-muted">{org.slug}</span>
            </span>
            {activeOrg?.id === org.id ? <Check className="size-3.5 text-accent" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            router.push('/settings/team');
          }}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Create or manage organizations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Inline link used by empty states that need a workspace decision. */
export function WorkspaceLink({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/settings/team" className="text-accent underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
