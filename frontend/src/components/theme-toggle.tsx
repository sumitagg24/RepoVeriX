'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  variant?: 'ghost' | 'solid';
}

/** Sun/moon toggle that cross-fades between the two glyphs. */
export function ThemeToggle({ className, variant = 'ghost' }: ThemeToggleProps) {
  const { theme, mounted, toggleTheme } = useTheme();
  const [shown, setShown] = useState<'light' | 'dark'>('light');

  // Wait for hydration + context sync before drawing the correct glyph so SSR
  // markup never disagrees with the applied class.
  useEffect(() => {
    if (mounted) setShown(theme);
  }, [theme, mounted]);

  const isDark = shown === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl transition-all duration-200 active:scale-95',
        variant === 'solid'
          ? 'border bg-card text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground hover:bg-card/80'
          : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
        className
      )}
    >
      {!mounted ? (
        <span className="h-4 w-4 rounded-full bg-muted" />
      ) : (
        <>
          <Sun
            className={cn(
              'absolute h-[18px] w-[18px] transition-all duration-300',
              isDark ? 'translate-y-0 rotate-0 opacity-0' : 'translate-y-0 rotate-90 opacity-100'
            )}
          />
          <Moon
            className={cn(
              'absolute h-[18px] w-[18px] transition-all duration-300',
              isDark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-2 rotate-0 opacity-0'
            )}
          />
        </>
      )}
    </button>
  );
}
