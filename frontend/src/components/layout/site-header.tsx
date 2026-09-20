'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Wordmark } from '@/components/layout/logo';
import { PUBLIC_NAV } from '@/lib/site';
import { cn } from '@/lib/utils';

/**
 * Public navigation.
 *
 * One line at every desktop width, 64px tall, with the current section marked by
 * weight and colour rather than an underline animation. Below `lg` the same links
 * move into a full-height drawer with the call to action pinned at the bottom.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-6 px-5 sm:px-8 lg:px-10">
        <Wordmark />

        <nav aria-label="Main" className="hidden lg:flex lg:items-center lg:gap-1">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-2 text-[13.5px] transition-colors duration-150',
                isActive(item.href)
                  ? 'font-medium text-ink'
                  : 'text-body hover:bg-surface hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex">
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="primary" size="sm" className="hidden lg:inline-flex">
            <Link href="/auth/sign-up">Start free</Link>
          </Button>

          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
                <Menu className="size-4.5" aria-hidden="true" />
              </Button>
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-neutral-950/45 lg:hidden" />
              <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col bg-canvas lg:hidden">
                <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
                  <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                  <Wordmark />
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close navigation menu">
                      <X className="size-4.5" aria-hidden="true" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
                <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-5 py-6">
                  <ul className="divide-y divide-hairline">
                    {PUBLIC_NAV.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          aria-current={isActive(item.href) ? 'page' : undefined}
                          className="flex items-center justify-between py-3.5 text-[16px] text-ink"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 flex items-center justify-between">
                    <span className="text-[13px] text-muted">Appearance</span>
                    <ThemeToggle align="start" />
                  </div>
                </nav>
                <div className="space-y-2 border-t border-hairline px-5 py-5">
                  <Button asChild variant="primary" size="lg" className="w-full">
                    <Link href="/auth/sign-up" onClick={() => setOpen(false)}>
                      Start free
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="lg" className="w-full">
                    <Link href="/auth/sign-in" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      </div>
    </header>
  );
}
