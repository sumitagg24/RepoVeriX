'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';

/**
 * Theme control.
 *
 * A three-way menu (light, dark, system) instead of a sun/moon switch: the
 * "follow the system" case is a real choice here, and the current mode is named
 * in text rather than implied by an icon.
 */
export function ThemeToggle({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = theme === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Appearance: ${theme === 'system' ? 'system' : theme}`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-44">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setTheme('light')} aria-current={theme === 'light'}>
          <Sun className="size-3.5" aria-hidden="true" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')} aria-current={theme === 'dark'}>
          <Moon className="size-3.5" aria-hidden="true" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')} aria-current={theme === 'system'}>
          <Monitor className="size-3.5" aria-hidden="true" />
          Match system
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
