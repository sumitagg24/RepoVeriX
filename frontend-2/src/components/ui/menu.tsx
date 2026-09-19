'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';

// ------------------------------------------------------------------- menu

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownMenuContent({
  children,
  className,
  align = 'end',
  sideOffset = 6,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-xl border border-hairline bg-card p-1 text-ink shadow-overlay',
          'data-[state=open]:animate-scale-in',
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  children,
  className,
  destructive = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] outline-none transition-colors',
        'data-[highlighted]:bg-surface',
        destructive ? 'text-critical data-[highlighted]:bg-critical-soft' : 'text-body data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="px-2.5 py-1.5 text-[12px] font-medium text-muted">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export function DropdownMenuSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1 h-px bg-hairline" />;
}

// ------------------------------------------------------------------- tabs

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <TabsPrimitive.List
      aria-label={label}
      className={cn('flex items-center gap-1 border-b border-hairline', className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  count,
  className,
}: {
  value: string;
  children: React.ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'relative -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-[13.5px] font-medium text-muted',
        'transition-colors duration-150 hover:text-ink',
        'data-[state=active]:border-accent data-[state=active]:text-ink',
        className,
      )}
    >
      {children}
      {count != null ? (
        <span className="rounded-sm bg-surface px-1.5 text-[11.5px] tabular-nums text-muted">{count}</span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content value={value} className={cn('focus-visible:outline-none', className)}>
      {children}
    </TabsPrimitive.Content>
  );
}

// -------------------------------------------------------------- accordion

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  value,
  question,
  children,
}: {
  value: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionPrimitive.Item value={value} className="border-b border-hairline">
      <AccordionPrimitive.Header>
        <AccordionPrimitive.Trigger className="group flex w-full items-center justify-between gap-4 py-4 text-left text-[14.5px] font-medium text-ink transition-colors hover:text-accent">
          {question}
          <ChevronDown
            className="size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:hidden">
        <div className="max-w-[68ch] pb-5 text-[14px] leading-relaxed text-body">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}
