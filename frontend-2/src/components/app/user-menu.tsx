'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, KeyRound, LifeBuoy, LogOut, Plug, Settings } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar } from '@/components/ui/misc';
import { PlanBadge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  if (!user) return null;

  const signOut = async () => {
    setPending(true);
    try {
      await logout();
      router.replace('/auth/sign-in');
    } catch {
      toast.error('Could not sign out', {
        description: 'The session is still active locally. Try again, or clear site data.',
      });
      setPending(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Account menu for ${user.full_name ?? user.email}`}>
          <Avatar name={user.full_name ?? user.email} size={24} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <div className="px-2.5 py-2">
          <p className="truncate text-[13.5px] font-medium text-ink">{user.full_name}</p>
          <p className="truncate text-[12px] text-muted">{user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <PlanBadge plan={user.plan} />
            {user.email_verified === false ? (
              <span className="text-[11.5px] text-high">Email not verified</span>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-3.5" aria-hidden="true" />
            Preferences
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/security">
            <KeyRound className="size-3.5" aria-hidden="true" />
            Security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/integrations">
            <Plug className="size-3.5" aria-hidden="true" />
            Integrations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/billing">
            <CreditCard className="size-3.5" aria-hidden="true" />
            Billing and usage
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/help">
            <LifeBuoy className="size-3.5" aria-hidden="true" />
            Help and shortcuts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive disabled={pending} onSelect={() => void signOut()}>
          <LogOut className="size-3.5" aria-hidden="true" />
          {pending ? 'Signing out' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
